import { env } from "../config/env";
import { prisma } from "../config/prisma";

const SYSTEM_PROMPT = `You are Sol, a warm, calm, emotionally intelligent wellness companion inside the Solace AI app.

Rules:
- Be empathetic first. Reflect back what you hear before suggesting anything.
- Keep replies short (2-5 sentences) unless the user asks for more.
- Ask at most one thoughtful follow-up question.
- Do NOT diagnose, prescribe medication, or make medical claims. You are not a therapist.
- If the user mentions self-harm, suicide, or immediate danger: respond with care, encourage them to reach out right now to a trusted person or local emergency services / a crisis line, and stay with them in the conversation. Keep it caring, not clinical.
- Avoid generic motivational cliches ("you got this!", "just stay positive!"). Prefer specific, grounded, practical suggestions.
- When it fits, suggest one small activity that exists in the app: box breathing, a mood check-in, today's affirmation, "Three Good Things", a 2-minute body scan, or a self-kindness note.
- You may reference the user's recent moods and earlier conversations ONLY from the context given to you. Never invent personal details.
- Use plain language. Warm, gentle, human.`;

const CRISIS_PATTERN =
  /\b(kill myself|suicid|end my life|want to die|self[- ]?harm|hurt myself|cut myself|no reason to live)\b/i;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface AiContext {
  displayName: string;
  personalization: boolean;
  useMoodContext: boolean;
  recentMoods?: { mood: string; intensity: number; note: string | null; createdAt: Date }[];
  earlierTopics?: string[];
  lastAssessmentScore?: number | null;
}

async function callModel(messages: ChatMessage[], maxTokens = 400, temperature = 0.7): Promise<string> {
  if (!env.aiApiKey) throw new Error("AI_API_KEY is not configured on the server.");
  const res = await fetch(`${env.aiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.aiApiKey}` },
    body: JSON.stringify({
      model: env.aiModel,
      messages,
      temperature,
      max_tokens: Math.max(maxTokens, 1200),
      ...(env.aiModel.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI provider error (${res.status}): ${text.slice(0, 300)}`);
  }
  const data: any = await res.json();
  return (data.choices?.[0]?.message?.content as string | undefined)?.trim() ?? "";
}

function contextBlock(ctx: AiContext): string | null {
  if (!ctx.personalization) return null;
  const lines = [`The user's name is ${ctx.displayName}.`];
  if (ctx.useMoodContext && ctx.recentMoods?.length) {
    const moods = ctx.recentMoods
      .map(
        (m) =>
          `${m.mood.replace("_", " ")} (intensity ${m.intensity}/5) on ${m.createdAt.toISOString().slice(0, 10)}` +
          (m.note ? ` - note: "${m.note.slice(0, 120)}"` : "")
      )
      .join("; ");
    lines.push(`Recent mood check-ins (newest first): ${moods}.`);
  }
  if (ctx.earlierTopics?.length) {
    lines.push(`Earlier conversation topics: ${ctx.earlierTopics.join("; ")}.`);
  }
  if (ctx.lastAssessmentScore != null) {
    lines.push(`Latest self-reflection check score: ${ctx.lastAssessmentScore}/100 (higher = feeling better).`);
  }
  return lines.join("\n");
}

export async function generateAiReply(history: ChatMessage[], userMessage: string, ctx: AiContext): Promise<string> {
  const block = contextBlock(ctx);
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(block ? [{ role: "system" as const, content: `Context:\n${block}` }] : []),
    ...(CRISIS_PATTERN.test(userMessage)
      ? [
          {
            role: "system" as const,
            content:
              "The latest message may indicate risk of self-harm. Put safety first: acknowledge their pain warmly, ask if they are safe right now, and encourage contacting emergency services, a crisis line, or someone they trust immediately.",
          },
        ]
      : []),
    ...history,
    { role: "user", content: userMessage },
  ];
  return callModel(messages);
}

/** One short, specific suggestion for the home screen, based on the user's latest moods. */
export async function generateDailySuggestion(ctx: AiContext): Promise<string> {
  const block = contextBlock(ctx) ?? "No personal context is available.";
  return callModel(
    [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${block}\n\nWrite ONE gentle suggestion for today in at most 2 short sentences, addressed to the user. Mention one concrete in-app activity. No greeting, no quotes, no emojis.`,
      },
    ],
    90,
    0.8
  );
}

export async function suggestTitle(firstUserMessage: string): Promise<string> {
  const trimmed = firstUserMessage.trim().replace(/\s+/g, " ");
  if (!trimmed) return "New conversation";
  return trimmed.length <= 42 ? trimmed : trimmed.slice(0, 39) + "…";
}

export async function buildUserContext(userId: string, excludeConversationId?: string): Promise<AiContext> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { preferences: true } });
  if (!user) throw new Error("User not found");
  const personalization = user.preferences?.aiPersonalization ?? true;
  const useMoodContext = user.preferences?.aiUseMoodContext ?? true;

  const ctx: AiContext = { displayName: user.displayName, personalization, useMoodContext };
  if (!personalization) return ctx;

  const [moods, convs, assessment] = await Promise.all([
    useMoodContext
      ? prisma.moodEntry.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { mood: true, intensity: true, note: true, createdAt: true },
        })
      : Promise.resolve(undefined),
    prisma.conversation.findMany({
      where: { userId, ...(excludeConversationId ? { id: { not: excludeConversationId } } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { title: true },
    }),
    prisma.wellnessAssessment.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { score: true } }),
  ]);

  ctx.recentMoods = moods;
  ctx.earlierTopics = convs.map((c) => c.title).filter((t) => t !== "New conversation");
  ctx.lastAssessmentScore = assessment?.score ?? null;
  return ctx;
}
