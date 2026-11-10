const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('./db');
const ai = require('./ai');
const { AFFIRMATIONS, DEFAULT_REMINDERS, WEATHER, COMPASS_DIALS, COMPASS_ADVICE, LIGHT, STAGES, KEEPSAKES } = require('./content');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// ---------- helpers ----------
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const localDay = (req) => {
  const h = req.get('x-local-date');
  return h && /^\d{4}-\d{2}-\d{2}$/.test(h) ? h : new Date().toISOString().slice(0, 10);
};
const addDays = (day, n) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const parse = (schema, data) => {
  const r = schema.safeParse(data);
  if (!r.success) {
    const err = new Error(r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '));
    err.status = 400;
    throw err;
  }
  return r.data;
};

const signToken = (user) => jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '60d' });

const auth = (req, res, next) => {
  const h = req.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    const { sub } = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, name, goals, created_at FROM users WHERE id = ?').get(sub);
    if (!user) return res.status(401).json({ error: 'Account not found' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired' });
  }
};

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, goals: JSON.parse(u.goals || '[]'), createdAt: u.created_at });

function awardXp(userId, source, day, amount = LIGHT[source] ?? 5) {
  db.prepare('INSERT INTO xp_log (user_id, source, amount, day) VALUES (?, ?, ?, ?)').run(userId, source, amount, day);
  return amount;
}

function computeStats(userId, today) {
  const light = db.prepare('SELECT COALESCE(SUM(amount),0) AS xp FROM xp_log WHERE user_id = ?').get(userId).xp;
  const days = new Set(db.prepare('SELECT DISTINCT day FROM xp_log WHERE user_id = ?').all(userId).map((r) => r.day));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  let idx = 0;
  STAGES.forEach((st, i) => { if (light >= st.from) idx = i; });
  const next = STAGES[idx + 1];
  return {
    light,
    stage: STAGES[idx].key,
    stageName: STAGES[idx].name,
    stageIndex: idx,
    lightIntoStage: light - STAGES[idx].from,
    lightForNext: next ? next.from - STAGES[idx].from : null,
    streak,
    activeToday: days.has(today),
  };
}

function computeKeepsakes(userId, stats) {
  const count = (sql) => db.prepare(sql).get(userId).c;
  const earned = new Set();
  if (count('SELECT COUNT(*) c FROM moods WHERE user_id = ?') > 0) earned.add('first_weather');
  const breaths = count("SELECT COUNT(*) c FROM activities WHERE user_id = ? AND kind = 'breathe'");
  if (breaths > 0) earned.add('first_breath');
  if (breaths >= 10) earned.add('breath10');
  if (count('SELECT COUNT(*) c FROM conversations WHERE user_id = ?') > 0) earned.add('first_chat');
  if (count("SELECT COUNT(*) c FROM activities WHERE user_id = ? AND kind = 'unload'") > 0) earned.add('letgo');
  if (count("SELECT COUNT(*) c FROM activities WHERE user_id = ? AND kind = 'gratitude'") >= 5) earned.add('jar5');
  if (stats.streak >= 3) earned.add('streak3');
  if (stats.streak >= 7) earned.add('streak7');
  if (stats.stageIndex >= 1) earned.add('sprout');
  return KEEPSAKES.map((a) => ({ ...a, earned: earned.has(a.id) }));
}

const affirmationFor = (day) => {
  const n = Number(day.replace(/-/g, '')) % AFFIRMATIONS.length;
  return AFFIRMATIONS[n];
};

function buildPlan(userId, today) {
  const moodToday = db.prepare('SELECT mood, tags FROM moods WHERE user_id = ? AND day = ? ORDER BY id DESC LIMIT 1').get(userId, today);
  const lastMood = moodToday || db.prepare('SELECT mood, tags FROM moods WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);
  const tags = lastMood ? JSON.parse(lastMood.tags) : [];
  const lastCompass = db.prepare("SELECT band FROM assessments WHERE user_id = ? AND kind = 'compass' ORDER BY id DESC LIMIT 1").get(userId);
  const did = (kind) => !!db.prepare('SELECT 1 FROM activities WHERE user_id = ? AND day = ? AND kind = ? LIMIT 1').get(userId, today, kind);
  const chatted = !!db.prepare(
    `SELECT 1 FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE c.user_id = ? AND m.role = 'user' AND date(m.created_at) = date('now') LIMIT 1`
  ).get(userId);

  const tense = tags.includes('anxious') || tags.includes('stressed') || lastCompass?.band === 'calm';
  const low = lastMood && lastMood.mood <= 2;
  const items = [{ id: 'weather', title: 'Check your inner weather', subtitle: 'Tell Sol what the sky looks like', route: '/checkin', done: !!moodToday }];
  items.push(
    tense
      ? { id: 'breathe', title: 'A long, slow exhale', subtitle: '4-7-8 breathing settles a busy mind', route: '/breathe?technique=478', done: did('breathe') }
      : { id: 'breathe', title: 'Box breathing, 4 rounds', subtitle: 'Two quiet minutes with Sol', route: '/breathe?technique=box', done: did('breathe') }
  );
  if (low) items.push({ id: 'chat', title: 'Talk it through with Sol', subtitle: 'Say what is on your mind', route: '/chat/new', done: chatted });
  else if (tags.includes('sleep')) items.push({ id: 'winddown', title: 'Sleep wind-down', subtitle: 'A gentle body scan for tonight', route: '/pocket/winddown', done: did('winddown') });
  else items.push({ id: 'gratitude', title: 'Drop one thing in the jar', subtitle: 'Something small that was good', route: '/pocket/gratitude', done: did('gratitude') });
  if (tags.includes('overthinking') || tags.includes('stressed')) items.push({ id: 'unload', title: 'Unload a worry', subtitle: 'Type it out, then let it dissolve', route: '/pocket/unload', done: did('unload') });
  return items;
}

// ---------- routes ----------
app.get('/health', (req, res) => res.json({ ok: true, ai: process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'fallback' }));

const api = express.Router();
app.use('/api', api);

api.post('/auth/register', wrap((req, res) => {
  const b = parse(z.object({
    name: z.string().trim().min(1).max(60),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(6).max(100),
    goals: z.array(z.string().max(40)).max(8).optional(),
  }), req.body);
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(b.email)) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }
  const info = db.prepare('INSERT INTO users (email, name, password_hash, goals) VALUES (?, ?, ?, ?)')
    .run(b.email, b.name, bcrypt.hashSync(b.password, 10), JSON.stringify(b.goals || []));
  const ins = db.prepare('INSERT INTO reminders (user_id, kind, label, time, days, enabled) VALUES (?, ?, ?, ?, ?, ?)');
  for (const r of DEFAULT_REMINDERS) ins.run(info.lastInsertRowid, r.kind, r.label, r.time, JSON.stringify(r.days), r.enabled);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

api.post('/auth/login', wrap((req, res) => {
  const b = parse(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }), req.body);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(b.email);
  if (!user || !bcrypt.compareSync(b.password, user.password_hash)) {
    return res.status(401).json({ error: 'Email or password is incorrect' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

api.get('/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

api.patch('/me', auth, wrap((req, res) => {
  const b = parse(z.object({
    name: z.string().trim().min(1).max(60).optional(),
    goals: z.array(z.string().max(40)).max(8).optional(),
  }), req.body);
  db.prepare('UPDATE users SET name = COALESCE(?, name), goals = COALESCE(?, goals) WHERE id = ?')
    .run(b.name ?? null, b.goals ? JSON.stringify(b.goals) : null, req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
}));

api.delete('/me', auth, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  res.json({ ok: true });
});

api.get('/home', auth, (req, res) => {
  const today = localDay(req);
  const stats = computeStats(req.user.id, today);
  const lastMood = db.prepare('SELECT mood, tags, note, day FROM moods WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id);
  res.json({
    name: req.user.name,
    affirmation: affirmationFor(today),
    stats,
    plan: buildPlan(req.user.id, today),
    lastMood: lastMood ? { ...lastMood, tags: JSON.parse(lastMood.tags) } : null,
    moodLoggedToday: lastMood?.day === today,
  });
});

api.post('/moods', auth, wrap((req, res) => {
  const b = parse(z.object({
    mood: z.number().int().min(1).max(5),
    tags: z.array(z.string().max(30)).max(10).default([]),
    note: z.string().max(1000).default(''),
  }), req.body);
  const day = localDay(req);
  const first = !db.prepare('SELECT 1 FROM moods WHERE user_id = ? AND day = ?').get(req.user.id, day);
  db.prepare('INSERT INTO moods (user_id, mood, tags, note, day) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, b.mood, JSON.stringify(b.tags), b.note, day);
  const gained = first ? awardXp(req.user.id, 'mood', day) : 0;
  res.status(201).json({ lightGained: gained, stats: computeStats(req.user.id, day) });
}));

api.get('/moods', auth, (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365);
  const rows = db.prepare(
    `SELECT id, mood, tags, note, day, created_at FROM moods WHERE user_id = ? AND day >= ? ORDER BY id DESC`
  ).all(req.user.id, addDays(localDay(req), -days));
  res.json({ moods: rows.map((r) => ({ ...r, tags: JSON.parse(r.tags) })) });
});

api.post('/compass', auth, wrap((req, res) => {
  const b = parse(z.object({ answers: z.array(z.number().int().min(0).max(3)).length(4) }), req.body);
  const day = localDay(req);
  const total = b.answers.reduce((n, v) => n + v, 0);
  let low = 0;
  b.answers.forEach((v, i) => { if (v < b.answers[low]) low = i; });
  const dial = COMPASS_DIALS[low];
  db.prepare('INSERT INTO assessments (user_id, kind, score, max_score, band, answers, day) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(req.user.id, 'compass', total, 12, dial, JSON.stringify(b.answers), day);
  const gained = awardXp(req.user.id, 'compass', day);
  res.status(201).json({
    dials: COMPASS_DIALS.map((k, i) => ({ key: k, value: b.answers[i] })),
    lowest: dial,
    ...COMPASS_ADVICE[dial],
    showSupport: total <= 3,
    lightGained: gained,
    stats: computeStats(req.user.id, day),
  });
}));

api.get('/compass', auth, (req, res) => {
  const rows = db.prepare("SELECT answers, band, day FROM assessments WHERE user_id = ? AND kind = 'compass' ORDER BY id DESC LIMIT 14").all(req.user.id);
  res.json({ history: rows.map((r) => ({ day: r.day, lowest: r.band, answers: JSON.parse(r.answers) })) });
});

api.post('/activities', auth, wrap((req, res) => {
  const b = parse(z.object({
    kind: z.enum(['breathe', 'unload', 'ground', 'gratitude', 'winddown', 'affirmation']),
    detail: z.string().max(80).default(''),
    seconds: z.number().int().min(0).max(7200).default(0),
  }), req.body);
  const day = localDay(req);
  // Affirmation light counts once a day; the rest are capped at 3 rewarded sessions per kind per day.
  const sameToday = db.prepare('SELECT COUNT(*) AS n FROM activities WHERE user_id = ? AND day = ? AND kind = ?').get(req.user.id, day, b.kind).n;
  const repeat = b.kind === 'affirmation' ? sameToday >= 1 : sameToday >= 3;
  db.prepare('INSERT INTO activities (user_id, kind, detail, seconds, day) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, b.kind, b.detail, b.seconds, day);
  const gained = repeat ? 0 : awardXp(req.user.id, b.kind, day);
  res.status(201).json({ lightGained: gained, stats: computeStats(req.user.id, day) });
}));

api.get('/progress', auth, (req, res) => {
  const today = localDay(req);
  const stats = computeStats(req.user.id, today);
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const day = addDays(today, -i);
    const mood = db.prepare('SELECT AVG(mood) AS avg FROM moods WHERE user_id = ? AND day = ?').get(req.user.id, day).avg;
    const light = db.prepare('SELECT COALESCE(SUM(amount),0) AS xp FROM xp_log WHERE user_id = ? AND day = ?').get(req.user.id, day).xp;
    week.push({ day, mood: mood ? Math.round(mood * 10) / 10 : null, light });
  }
  const totals = db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM moods WHERE user_id = @u) AS moods,
       (SELECT COUNT(*) FROM activities WHERE user_id = @u AND kind = 'breathe') AS breaths,
       (SELECT COALESCE(SUM(seconds),0) FROM activities WHERE user_id = @u AND kind = 'breathe') AS breathSeconds,
       (SELECT COUNT(*) FROM activities WHERE user_id = @u AND kind = 'unload') AS released,
       (SELECT COUNT(*) FROM activities WHERE user_id = @u AND kind = 'gratitude') AS gratitude,
       (SELECT COUNT(*) FROM conversations WHERE user_id = @u) AS chats`
  ).get({ u: req.user.id });
  const topTags = {};
  db.prepare('SELECT tags FROM moods WHERE user_id = ? AND day >= ?').all(req.user.id, addDays(today, -30))
    .forEach((r) => JSON.parse(r.tags).forEach((t) => { topTags[t] = (topTags[t] || 0) + 1; }));
  res.json({
    stats, week, totals,
    topTags: Object.entries(topTags).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag, count]) => ({ tag, count })),
    keepsakes: computeKeepsakes(req.user.id, stats),
  });
});

api.get('/reflection', auth, wrap(async (req, res) => {
  const today = localDay(req);
  const from = addDays(today, -6);
  const moods = db.prepare('SELECT mood, tags, day FROM moods WHERE user_id = ? AND day >= ?').all(req.user.id, from);
  const count = (kind) => db.prepare('SELECT COUNT(*) AS n FROM activities WHERE user_id = ? AND day >= ? AND kind = ?').get(req.user.id, from, kind).n;
  const tagCount = {};
  moods.forEach((m) => JSON.parse(m.tags).forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const week = {
    checkins: new Set(moods.map((m) => m.day)).size,
    avgMood: moods.length ? Math.round((moods.reduce((n, m) => n + m.mood, 0) / moods.length) * 10) / 10 : null,
    breaths: count('breathe'), released: count('unload'), gratitude: count('gratitude'),
    tags: Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t),
    streak: computeStats(req.user.id, today).streak,
  };
  const out = await ai.letter(req.user.name.split(' ')[0], week);
  res.json({ letter: out.text, provider: out.provider, week });
}));

api.get('/plan', auth, (req, res) => res.json({ plan: buildPlan(req.user.id, localDay(req)) }));

// ----- reminders (preferences are stored server side so they follow the user) -----
const reminderRow = (r) => ({ id: r.id, kind: r.kind, label: r.label, time: r.time, days: JSON.parse(r.days), enabled: !!r.enabled });

api.get('/reminders', auth, (req, res) => {
  res.json({ reminders: db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY time').all(req.user.id).map(reminderRow) });
});

api.put('/reminders', auth, wrap((req, res) => {
  const b = parse(z.object({
    reminders: z.array(z.object({
      kind: z.enum(['checkin', 'affirmation', 'breathe', 'selfcare', 'custom']),
      label: z.string().trim().min(1).max(60),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
      enabled: z.boolean(),
    })).max(20),
  }), req.body);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM reminders WHERE user_id = ?').run(req.user.id);
    const ins = db.prepare('INSERT INTO reminders (user_id, kind, label, time, days, enabled) VALUES (?, ?, ?, ?, ?, ?)');
    b.reminders.forEach((r) => ins.run(req.user.id, r.kind, r.label, r.time, JSON.stringify(r.days), r.enabled ? 1 : 0));
  });
  tx();
  res.json({ reminders: db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY time').all(req.user.id).map(reminderRow) });
}));

// ----- conversations -----
const ownConversation = (req) => {
  const c = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id);
  if (!c) {
    const err = new Error('Conversation not found');
    err.status = 404;
    throw err;
  }
  return c;
};

api.get('/conversations', auth, (req, res) => {
  const rows = db.prepare(
    `SELECT c.id, c.title, c.updated_at AS updatedAt, c.created_at AS createdAt,
       (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) AS preview,
       (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) AS messageCount
     FROM conversations c WHERE c.user_id = ? ORDER BY c.updated_at DESC, c.id DESC`
  ).all(req.user.id);
  res.json({ conversations: rows });
});

api.post('/conversations', auth, (req, res) => {
  const info = db.prepare('INSERT INTO conversations (user_id) VALUES (?)').run(req.user.id);
  res.status(201).json({ conversation: db.prepare('SELECT id, title, created_at AS createdAt, updated_at AS updatedAt FROM conversations WHERE id = ?').get(info.lastInsertRowid) });
});

api.get('/conversations/:id', auth, wrap((req, res) => {
  const c = ownConversation(req);
  const messages = db.prepare('SELECT id, role, content, created_at AS createdAt FROM messages WHERE conversation_id = ? ORDER BY id').all(c.id);
  res.json({ conversation: { id: c.id, title: c.title }, messages });
}));

api.patch('/conversations/:id', auth, wrap((req, res) => {
  const c = ownConversation(req);
  const b = parse(z.object({ title: z.string().trim().min(1).max(80) }), req.body);
  db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(b.title, c.id);
  res.json({ ok: true });
}));

api.delete('/conversations/:id', auth, wrap((req, res) => {
  const c = ownConversation(req);
  db.prepare('DELETE FROM conversations WHERE id = ?').run(c.id);
  res.json({ ok: true });
}));

function buildChatContext(user, conversationId) {
  const recentMoods = db.prepare('SELECT mood, tags FROM moods WHERE user_id = ? ORDER BY id DESC LIMIT 5').all(user.id)
    .map((m) => ({ mood: m.mood, tags: JSON.parse(m.tags) }));
  const lastAssessments = db.prepare(
    `SELECT kind, band FROM assessments WHERE user_id = ? AND id IN (SELECT MAX(id) FROM assessments WHERE user_id = ? GROUP BY kind)`
  ).all(user.id, user.id);
  const others = db.prepare('SELECT id FROM conversations WHERE user_id = ? AND id != ? ORDER BY updated_at DESC LIMIT 3').all(user.id, conversationId);
  const pastThemes = [];
  for (const o of others) {
    const msgs = db.prepare("SELECT content FROM messages WHERE conversation_id = ? AND role = 'user' ORDER BY id DESC LIMIT 2").all(o.id);
    msgs.reverse().forEach((m) => pastThemes.push(m.content.slice(0, 140)));
  }
  return { name: user.name.split(' ')[0], goals: JSON.parse(user.goals || '[]'), recentMoods, lastAssessments, pastThemes };
}

api.post('/conversations/:id/messages', auth, wrap(async (req, res) => {
  const c = ownConversation(req);
  const b = parse(z.object({ content: z.string().trim().min(1).max(2000) }), req.body);
  const day = localDay(req);

  const userMsg = db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(c.id, 'user', b.content);
  if (c.title === 'New chat') {
    const title = b.content.length > 40 ? `${b.content.slice(0, 40).trim()}…` : b.content;
    db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, c.id);
  }

  const history = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 20').all(c.id).reverse();
  const out = await ai.reply(buildChatContext(req.user, c.id), history);

  const botMsg = db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(c.id, 'assistant', out.text);
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(c.id);

  const chatXpToday = db.prepare("SELECT COUNT(*) AS n FROM xp_log WHERE user_id = ? AND day = ? AND source = 'chat'").get(req.user.id, day).n;
  const gained = chatXpToday < 3 ? awardXp(req.user.id, 'chat', day) : 0;

  const get = (id) => db.prepare('SELECT id, role, content, created_at AS createdAt FROM messages WHERE id = ?').get(id);
  res.status(201).json({
    userMessage: get(userMsg.lastInsertRowid),
    assistantMessage: get(botMsg.lastInsertRowid),
    conversation: db.prepare('SELECT id, title FROM conversations WHERE id = ?').get(c.id),
    crisis: out.crisis,
    provider: out.provider,
    lightGained: gained,
  });
}));

// ---------- errors ----------
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, '0.0.0.0', () => console.log(`Solace API listening on :${port} (AI: ${process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'fallback'})`));
}
