import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { NotFound } from "../utils/errors";

const router = Router();
router.use(requireAuth);

const MOODS = ["very_happy","happy","neutral","sad","anxious","stressed","tired"] as const;

const createSchema = z.object({
  mood: z.enum(MOODS),
  intensity: z.number().int().min(1).max(5).default(3),
  note: z.string().trim().max(500).optional(),
});

router.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = createSchema.parse(req.body);
    const entry = await prisma.moodEntry.create({ data: { ...data, userId: req.userId! } });
    res.status(201).json({ entry });
  })
);

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const entries = await prisma.moodEntry.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ entries });
  })
);

router.get(
  "/summary",
  asyncHandler(async (req: AuthedRequest, res) => {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const entries = await prisma.moodEntry.findMany({
      where: { userId: req.userId!, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
    });
    const counts: Record<string, number> = {};
    entries.forEach((e) => (counts[e.mood] = (counts[e.mood] || 0) + 1));
    const avgIntensity =
      entries.length ? entries.reduce((s, e) => s + e.intensity, 0) / entries.length : 0;
    res.json({ total: entries.length, counts, avgIntensity, entries });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const r = await prisma.moodEntry.deleteMany({ where: { id: req.params.id, userId: req.userId! } });
    if (!r.count) throw NotFound("Check-in not found");
    res.json({ ok: true });
  })
);

export default router;