const { CRISIS_PATTERN } = require('./content');

const MODEL = process.env.AI_MODEL || 'claude-haiku-5-5';

const CRISIS_REPLY =
  "I'm really glad you told me. What you're feeling matters, and you don't have to hold it alone. " +
  "If you might act on these thoughts or you're in danger, please contact your local emergency number now, or a crisis line near you. " +
  "If you can, reach out to someone you trust and ask them to stay with you. I'm here with you too. Would you like to tell me a bit about what's happening right now?";

function systemPrompt(ctx) {
  const lines = [
    'You are Sol, a warm, calm wellness companion inside the Solace app.',
    'You are not a therapist and never diagnose or prescribe. You offer gentle support, reflection and small practical steps.',
    'Style: short (2 to 5 sentences), plain language, kind, never preachy. Ask at most one gentle question. No bullet lists unless asked.',
    'Mirror the user\'s language. If they write in Bangla or Banglish, answer in Bangla script.',
    'Suggest an in-app tool only when it genuinely fits: breathing (Calm tab), a check-in, or the daily plan. Say it naturally.',
    'If the user mentions self-harm or suicide, respond with care, encourage contacting local emergency services or a trusted person, and stay present.',
  ];
  if (ctx.name) lines.push(`The user's name is ${ctx.name}. Use it sparingly.`);
  if (ctx.goals?.length) lines.push(`Their goals: ${ctx.goals.join(', ')}.`);
  if (ctx.recentMoods?.length) {
    lines.push('Recent mood log (1 low to 5 great), newest first: ' + ctx.recentMoods.map((m) => `${m.mood}${m.tags.length ? ` (${m.tags.join('/')})` : ''}`).join(', ') + '.');
  }
  if (ctx.lastAssessments?.length) {
    lines.push('Their inner-compass dial that was lowest lately: ' + ctx.lastAssessments.map((a) => a.band).join(', ') + '.');
  }
  if (ctx.pastThemes?.length) {
    lines.push('Things they shared in earlier chats (use only if relevant, do not recite): ' + ctx.pastThemes.join(' | '));
  }
  return lines.join('\n');
}

async function callAnthropic(ctx, history) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: systemPrompt(ctx),
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data = await res.json();
  const text = data.content?.find((c) => c.type === 'text')?.text?.trim();
  return text || null;
}

// Offline fallback so the demo still works without an API key.
function fallbackReply(ctx, history) {
  const last = history[history.length - 1]?.content?.toLowerCase() || '';
  const name = ctx.name ? `, ${ctx.name}` : '';
  const has = (...w) => w.some((x) => last.includes(x));
  if (has('anxious', 'anxiety', 'panic', 'nervous', 'worried', 'overthink', 'stress')) {
    return `That sounds like a lot to carry${name}. When the mind is racing, the body usually needs to slow down first. Want to try one round of slow breathing together in the Calm tab? What is the biggest worry right now?`;
  }
  if (has('sad', 'down', 'lonely', 'empty', 'cry', 'depress', 'low')) {
    return `I'm sorry it feels this heavy${name}. You don't have to fix it tonight, just being honest about it is a real step. What has been weighing on you the most today?`;
  }
  if (has('sleep', 'tired', 'insomnia', 'exhaust')) {
    return `Being worn out makes everything feel harder${name}. Dimming lights and a slow exhale-heavy breath before bed can help. How has your sleep been this week?`;
  }
  if (has('angry', 'mad', 'frustrat', 'annoy')) {
    return `That frustration makes sense${name}. Anger often protects something tender underneath. What happened, if you want to tell me?`;
  }
  if (has('happy', 'good', 'great', 'proud', 'excited')) {
    return `I love hearing that${name}. Let it sink in for a moment. What made today feel good?`;
  }
  if (has('thank')) return `Anytime${name}. I'm glad you're here. Is there anything else on your mind?`;
  if (ctx.recentMoods?.[0] && ctx.recentMoods[0].mood <= 2) {
    return `I noticed your mood has been low lately${name}. I'm here and listening. What would feel even a little bit supportive right now?`;
  }
  return `Thank you for sharing that${name}. I'm listening. Could you tell me a little more about how it feels in your body or your day?`;
}

async function reply(ctx, history) {
  const last = history[history.length - 1]?.content || '';
  if (CRISIS_PATTERN.test(last)) return { text: CRISIS_REPLY, crisis: true, provider: 'safety' };
  try {
    const text = await callAnthropic(ctx, history);
    if (text) return { text, crisis: false, provider: 'anthropic' };
  } catch (e) {
    console.warn('AI provider failed, using fallback:', e.message);
  }
  return { text: fallbackReply(ctx, history), crisis: false, provider: 'fallback' };
}

// Sol's weekly letter: a short, personal note built from the week's data.
async function letter(name, week) {
  const key = process.env.ANTHROPIC_API_KEY;
  const facts = [
    `Days checked in: ${week.checkins}`,
    `Average inner weather (1 stormy to 5 sunny): ${week.avgMood ?? 'n/a'}`,
    `Breathing sessions: ${week.breaths}`,
    `Worries released: ${week.released}`,
    `Gratitude notes: ${week.gratitude}`,
    `Most common feelings: ${week.tags.join(', ') || 'none logged'}`,
    `Current streak: ${week.streak} days`,
  ].join('\n');
  if (key) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 350,
          system: 'You are Sol, a gentle garden companion. Write a short weekly letter (90 to 130 words) to the user. Warm, specific to the facts, no diagnosis, no lists, no headings. Celebrate effort not perfection. End with one small, kind intention for next week. Sign off as Sol.',
          messages: [{ role: 'user', content: `User name: ${name}\nThis week:\n${facts}` }],
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.content?.find((c) => c.type === 'text')?.text?.trim();
        if (text) return { text, provider: 'anthropic' };
      }
    } catch (e) {
      console.warn('letter AI failed:', e.message);
    }
  }
  const quiet = week.checkins === 0 && week.breaths === 0;
  const text = quiet
    ? `Dear ${name},\n\nThe garden was quiet this week, and that is okay. Gardens rest too. Whenever you are ready, one honest breath or one word about your inner weather is enough to start again. I will be here.\n\nWith care,\nSol`
    : `Dear ${name},\n\nThis week you showed up on ${week.checkins} day${week.checkins === 1 ? '' : 's'}${week.breaths ? ` and took ${week.breaths} breathing break${week.breaths === 1 ? '' : 's'}` : ''}. ${week.avgMood && week.avgMood < 3 ? 'The skies were heavy at times, and you kept tending the garden anyway.' : 'I saw some light in your days, and I noticed the effort behind it.'} Small, steady care is how things grow.\n\nNext week, maybe pick one tiny thing to do just for you.\n\nWith care,\nSol`;
  return { text, provider: 'fallback' };
}

module.exports = { reply, letter, CRISIS_REPLY };
