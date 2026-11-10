process.env.DB_PATH = ':memory:';
delete process.env.ANTHROPIC_API_KEY;
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');

let base;
let server;
let token;
const day = '2026-11-06';

test.before(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server.close());

const call = async (method, path, body, tok = token, d = day) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-local-date': d, ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
};

test('register, duplicate, login, wrong password', async () => {
  const r = await call('POST', '/auth/register', { name: 'Anik Ruhan', email: 'a@x.com', password: 'secret1', goals: ['calm'] }, null);
  assert.equal(r.status, 201);
  token = r.json.token;
  assert.equal((await call('POST', '/auth/register', { name: 'A', email: 'a@x.com', password: 'secret1' }, null)).status, 409);
  assert.equal((await call('POST', '/auth/login', { email: 'a@x.com', password: 'nope' }, null)).status, 401);
  assert.equal((await call('POST', '/auth/login', { email: 'a@x.com', password: 'secret1' }, null)).status, 200);
  assert.equal((await call('GET', '/me', null, null)).status, 401);
});

test('weather check-in grows the garden once per day', async () => {
  const a = await call('POST', '/moods', { mood: 2, tags: ['stressed', 'sleep'], note: 'rough' });
  assert.equal(a.status, 201);
  assert.equal(a.json.lightGained, 10);
  const b = await call('POST', '/moods', { mood: 3, tags: ['stressed'] });
  assert.equal(b.json.lightGained, 0);
  assert.equal((await call('POST', '/moods', { mood: 9 })).status, 400);
});

test('inner compass points at the lowest dial', async () => {
  const r = await call('POST', '/compass', { answers: [3, 0, 2, 3] });
  assert.equal(r.status, 201);
  assert.equal(r.json.lowest, 'calm');
  assert.equal(r.json.route, '/breathe?technique=478');
  assert.equal((await call('POST', '/compass', { answers: [1, 2] })).status, 400);
});

test('activities award capped light', async () => {
  for (let i = 0; i < 3; i++) assert.equal((await call('POST', '/activities', { kind: 'breathe', detail: 'box', seconds: 120 })).json.lightGained, 15);
  assert.equal((await call('POST', '/activities', { kind: 'breathe', detail: 'box', seconds: 120 })).json.lightGained, 0);
  assert.equal((await call('POST', '/activities', { kind: 'unload' })).json.lightGained, 10);
});

test('streak builds across days and stage advances', async () => {
  await call('POST', '/moods', { mood: 4 }, token, '2026-11-07');
  const p = await call('GET', '/progress', null, token, '2026-11-07');
  assert.equal(p.json.stats.streak, 2);
  assert.ok(p.json.stats.light >= 40);
  assert.equal(p.json.stats.stage, 'sprout');
  assert.equal(p.json.week.length, 7);
  assert.ok(p.json.keepsakes.find((k) => k.id === 'first_breath').earned);
});

test('home returns a personalised plan', async () => {
  const h = await call('GET', '/home');
  assert.equal(h.status, 200);
  assert.ok(h.json.plan.some((i) => i.route.startsWith('/breathe?technique=478')), 'tense -> 4-7-8');
  assert.ok(h.json.plan.some((i) => i.id === 'unload'));
  assert.ok(h.json.affirmation.length > 5);
});

test('conversations: create, chat with memory, list, rename, delete', async () => {
  const c1 = (await call('POST', '/conversations')).json.conversation;
  const m1 = await call('POST', `/conversations/${c1.id}/messages`, { content: 'I feel anxious about my exams' });
  assert.equal(m1.status, 201);
  assert.equal(m1.json.provider, 'fallback');
  assert.equal(m1.json.conversation.title, 'I feel anxious about my exams');
  assert.ok(m1.json.assistantMessage.content.length > 10);

  const c2 = (await call('POST', '/conversations')).json.conversation;
  await call('POST', `/conversations/${c2.id}/messages`, { content: 'hello again' });

  const list = await call('GET', '/conversations');
  assert.equal(list.json.conversations.length, 2);
  const detail = await call('GET', `/conversations/${c1.id}`);
  assert.equal(detail.json.messages.length, 2);

  assert.equal((await call('PATCH', `/conversations/${c1.id}`, { title: 'Exams' })).status, 200);
  assert.equal((await call('DELETE', `/conversations/${c1.id}`)).status, 200);
  assert.equal((await call('GET', `/conversations/${c1.id}`)).status, 404);
});

test('conversations are private to their owner', async () => {
  const other = (await call('POST', '/auth/register', { name: 'B', email: 'b@x.com', password: 'secret2' }, null)).json.token;
  const mine = (await call('POST', '/conversations')).json.conversation;
  assert.equal((await call('GET', `/conversations/${mine.id}`, null, other)).status, 404);
  assert.equal((await call('DELETE', `/conversations/${mine.id}`, null, other)).status, 404);
});

test('crisis messages get a safety reply, not the model', async () => {
  const c = (await call('POST', '/conversations')).json.conversation;
  const r = await call('POST', `/conversations/${c.id}/messages`, { content: 'I want to die' });
  assert.equal(r.json.crisis, true);
  assert.equal(r.json.provider, 'safety');
});

test('reminders persist and validate', async () => {
  const get = await call('GET', '/reminders');
  assert.equal(get.json.reminders.length, 4);
  const put = await call('PUT', '/reminders', { reminders: [{ kind: 'custom', label: 'Stretch', time: '10:15', days: [1, 3], enabled: true }] });
  assert.equal(put.json.reminders.length, 1);
  assert.equal(put.json.reminders[0].time, '10:15');
  assert.equal((await call('PUT', '/reminders', { reminders: [{ kind: 'custom', label: 'x', time: '25:00', days: [1], enabled: true }] })).status, 400);
});

test("Sol's weekly letter works without an API key", async () => {
  const r = await call('GET', '/reflection');
  assert.equal(r.status, 200);
  assert.match(r.json.letter, /Sol/);
});

test('delete account removes data', async () => {
  const t = (await call('POST', '/auth/register', { name: 'C', email: 'c@x.com', password: 'secret3' }, null)).json.token;
  assert.equal((await call('DELETE', '/me', null, t)).status, 200);
  assert.equal((await call('GET', '/me', null, t)).status, 401);
});
