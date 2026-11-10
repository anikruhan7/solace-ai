import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { NotFound } from "../utils/errors";
import { buildUserContext, generateDailySuggestion } from "../services/ai.service";

const router = Router();
router.use(requireAuth);

/** Client sends its timezone offset (minutes, as from Date#getTimezoneOffset) so days match the user's clock. */
function tzOffset(q: unknown): number {
  const n = Number(q);
  return Number.isFinite(n) && Math.abs(n) <= 14 * 60 ? n : 0;
}
function localDay(d: Date, offsetMin: number) {
  return new Date(d.getTime() - offsetMin * 60_000).toISOString().slice(0, 10);
}

router.get(
  "/activities",
  asyncHandler(async (_req, res) => {
    const activities = await prisma.wellnessActivity.findMany({ orderBy: { duration: "asc" } });
    res.json({ activities });
  })
);

router.post(
  "/activities/:id/complete",
  asyncHandler(async (req: AuthedRequest, res) => {
    const activity = await prisma.wellnessActivity.findUnique({ where: { id: req.params.id } });
    if (!activity) throw NotFound("Activity not found");
    const completion = await prisma.activityCompletion.create({
      data: { userId: req.userId!, activityId: activity.id, type: activity.category, duration: activity.duration },
    });
    res.status(201).json({ completion });
  })
);

/** Log a free-form session (e.g. a breathing session) that isn't tied to a catalogue activity. */
router.post(
  "/activities/log",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { type, duration } = z
      .object({ type: z.enum(["breathing", "reflection", "mindfulness", "custom"]), duration: z.number().int().min(0).max(240) })
      .parse(req.body);
    const completion = await prisma.activityCompletion.create({ data: { userId: req.userId!, type, duration } });
    res.status(201).json({ completion });
  })
);

router.get(
  "/affirmations/daily",
  asyncHandler(async (req: AuthedRequest, res) => {
    const all = await prisma.affirmation.findMany({ orderBy: { id: "asc" } });
    if (!all.length) return res.json({ affirmation: null });
    const dayIndex = Math.floor(Date.now() / 86400000) % all.length;
    const affirmation = all[dayIndex];
    const fav = await prisma.favoriteAffirmation.findUnique({
      where: { userId_affirmationId: { userId: req.userId!, affirmationId: affirmation.id } },
    });
    res.json({ affirmation: { ...affirmation, favorited: !!fav } });
  })
);

router.get(
  "/affirmations/random",
  asyncHandler(async (req: AuthedRequest, res) => {
    const exclude = typeof req.query.exclude === "string" ? req.query.exclude : undefined;
    const all = await prisma.affirmation.findMany({ where: exclude ? { id: { not: exclude } } : {} });
    if (!all.length) return res.json({ affirmation: null });
    const affirmation = all[Math.floor(Math.random() * all.length)];
    const fav = await prisma.favoriteAffirmation.findUnique({
      where: { userId_affirmationId: { userId: req.userId!, affirmationId: affirmation.id } },
    });
    res.json({ affirmation: { ...affirmation, favorited: !!fav } });
  })
);

router.get(
  "/affirmations/favorites",
  asyncHandler(async (req: AuthedRequest, res) => {
    const favs = await prisma.favoriteAffirmation.findMany({
      where: { userId: req.userId! },
      include: { affirmation: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ favorites: favs });
  })
);

router.post(
  "/affirmations/:id/favorite",
  asyncHandler(async (req: AuthedRequest, res) => {
    const aff = await prisma.affirmation.findUnique({ where: { id: req.params.id } });
    if (!aff) throw NotFound("Affirmation not found");
    const key = { userId_affirmationId: { userId: req.userId!, affirmationId: aff.id } };
    const existing = await prisma.favoriteAffirmation.findUnique({ where: key });
    if (existing) {
      await prisma.favoriteAffirmation.delete({ where: { id: existing.id } });
      return res.json({ favorited: false });
    }
    await prisma.favoriteAffirmation.create({ data: { userId: req.userId!, affirmationId: aff.id } });
    res.json({ favorited: true });
  })
);

router.post(
  "/assessments",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { answers, score } = z
      .object({ answers: z.record(z.number().int().min(0).max(4)), score: z.number().int().min(0).max(100) })
      .parse(req.body);
    const assessment = await prisma.wellnessAssessment.create({ data: { userId: req.userId!, answers, score } });
    res.status(201).json({ assessment });
  })
);

router.get(
  "/assessments/latest",
  asyncHandler(async (req: AuthedRequest, res) => {
    const assessment = await prisma.wellnessAssessment.findFirst({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
    });
    res.json({ assessment });
  })
);

router.get(
  "/suggestion",
  asyncHandler(async (req: AuthedRequest, res) => {
    const ctx = await buildUserContext(req.userId!);
    try {
      const text = await generateDailySuggestion(ctx);
      res.json({ suggestion: text || null, source: "ai" });
    } catch (e: any) {
      console.error("Suggestion error:", e?.message);
      res.json({ suggestion: null, source: "unavailable" });
    }
  })
);

router.get(
  "/progress/overview",
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const offset = tzOffset(req.query.tz);
    const since30 = new Date(Date.now() - 30 * 86400000);
    const [checkIns, completions, completions30d, moods] = await Promise.all([
      prisma.moodEntry.count({ where: { userId } }),
      prisma.activityCompletion.count({ where: { userId } }),
      prisma.activityCompletion.count({ where: { userId, createdAt: { gte: since30 } } }),
      prisma.moodEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 120 }),
    ]);

    // Streak: consecutive local days with a check-in. A streak stays alive until the end of today,
    // so if there is no check-in yet today we start counting from yesterday.
    const days = new Set(moods.map((m) => localDay(m.createdAt, offset)));
    const today = localDay(new Date(), offset);
    const cursor = new Date(`${today}T00:00:00Z`);
    if (!days.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
    let streak = 0;
    while (days.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    res.json({
      checkIns,
      completions,
      completions30d,
      streak,
      checkedInToday: days.has(today),
      moods: moods.slice(0, 60),
    });
  })
);

export default router;
