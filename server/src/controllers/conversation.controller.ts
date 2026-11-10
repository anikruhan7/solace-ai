import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError, NotFound } from "../utils/errors";
import { buildUserContext, generateAiReply, suggestTitle } from "../services/ai.service";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const list = await prisma.conversation.findMany({
      where: { userId: req.userId! },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { messages: true } } },
    });
    res.json({ conversations: list });
  })
);

router.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const conv = await prisma.conversation.create({
      data: { userId: req.userId!, title: "New conversation" },
    });
    res.status(201).json({ conversation: conv });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conv) throw NotFound();
    res.json({ conversation: conv });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { title } = z.object({ title: z.string().min(1).max(120) }).parse(req.body);
    const updated = await prisma.conversation.updateMany({
      where: { id: req.params.id, userId: req.userId! },
      data: { title },
    });
    if (!updated.count) throw NotFound();
    res.json({ ok: true });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const r = await prisma.conversation.deleteMany({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!r.count) throw NotFound();
    res.json({ ok: true });
  })
);

router.post(
  "/:id/messages",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { content } = z.object({ content: z.string().trim().min(1).max(4000) }).parse(req.body);
    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
    if (!conv) throw NotFound();

    const ctx = await buildUserContext(req.userId!, conv.id);
    const history = [...conv.messages].reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Ask the AI first. If it fails nothing is saved, so the app can offer a clean retry.
    let reply: string;
    try {
      reply = await generateAiReply(history, content, ctx);
      if (!reply) throw new Error("Empty AI reply");
    } catch (e: any) {
      console.error("AI error:", e?.message);
      throw new HttpError(502, "Sol couldn't reply just now. Please try again.");
    }

    const [userMessage, aiMessage] = await prisma.$transaction([
      prisma.message.create({ data: { conversationId: conv.id, role: "user", content } }),
      prisma.message.create({ data: { conversationId: conv.id, role: "assistant", content: reply } }),
    ]);

    await prisma.conversation.update({
      where: { id: conv.id },
      data: conv.messages.length === 0 ? { title: await suggestTitle(content) } : { updatedAt: new Date() },
    });

    res.json({ userMessage, message: aiMessage });
  })
);

export default router;