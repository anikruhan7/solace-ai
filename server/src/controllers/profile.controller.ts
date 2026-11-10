import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth);

router.patch(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = z
      .object({
        displayName: z.string().min(1).max(60).optional(),
        avatarUrl: z.string().url().optional().nullable(),
      })
      .parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data,
      select: { id: true, email: true, displayName: true, avatarUrl: true },
    });
    res.json({ user });
  })
);

const prefsSchema = z.object({
  aiPersonalization: z.boolean().optional(),
  aiUseMoodContext: z.boolean().optional(),
  dailyMoodReminder: z.boolean().optional(),
  dailyMoodTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  affirmationReminder: z.boolean().optional(),
  affirmationTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  breathingReminder: z.boolean().optional(),
  breathingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  selfCareReminder: z.boolean().optional(),
  selfCareTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

router.patch(
  "/preferences",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = prefsSchema.parse(req.body);
    const prefs = await prisma.userPreferences.upsert({
      where: { userId: req.userId! },
      update: data,
      create: { userId: req.userId!, ...data },
    });
    res.json({ preferences: prefs });
  })
);

router.post(
  "/device-token",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { token, platform } = z
      .object({ token: z.string().min(1), platform: z.enum(["ios", "android", "web"]) })
      .parse(req.body);
    await prisma.deviceToken.upsert({
      where: { token },
      update: { userId: req.userId! },
      create: { token, platform, userId: req.userId! },
    });
    res.json({ ok: true });
  })
);

router.delete(
  "/account",
  asyncHandler(async (req: AuthedRequest, res) => {
    await prisma.user.delete({ where: { id: req.userId! } });
    res.json({ ok: true });
  })
);

export default router;