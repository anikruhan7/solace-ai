// Static content and rules for "Sol's Garden".

const AFFIRMATIONS = [
  'I can begin again, as many times as it takes.',
  'My feelings are weather. They pass through, I stay.',
  'Small steps still move me forward.',
  'I am allowed to rest without earning it first.',
  'I talk to myself the way I would talk to a friend.',
  'Today I only need to do the next kind thing.',
  'I do not have to have it all figured out.',
  'It is okay to take up space.',
  'I have survived every hard day so far.',
  'My worth is not measured by my productivity.',
  'I can feel nervous and still be brave.',
  'Slow is still growing.',
  'I deserve the patience I give to others.',
  'Breathing in, I settle. Breathing out, I soften.',
  'I am learning, and learning takes time.',
  'Asking for help is a strength.',
  'I can let go of what I cannot control today.',
  'One honest breath is enough to start.',
  'I choose to notice one good thing today.',
  'I am more than my worst moment.',
  'Rest is part of the work.',
  'I am doing the best I can with what I have right now.',
  'It is safe to slow down.',
  'Some days, getting through is the win.',
];

const DEFAULT_REMINDERS = [
  { kind: 'checkin', label: 'How is your inner weather?', time: '20:00', days: [1, 2, 3, 4, 5, 6, 7], enabled: 1 },
  { kind: 'affirmation', label: 'Morning light', time: '08:30', days: [1, 2, 3, 4, 5, 6, 7], enabled: 1 },
  { kind: 'breathe', label: 'Breathing break', time: '15:00', days: [1, 2, 3, 4, 5], enabled: 0 },
  { kind: 'selfcare', label: 'Water Sol\'s garden', time: '18:30', days: [1, 2, 3, 4, 5, 6, 7], enabled: 0 },
];

// Weather scale used for mood: 1 stormy ... 5 sunny.
const WEATHER = { 1: 'stormy', 2: 'rainy', 3: 'foggy', 4: 'cloudy', 5: 'sunny' };

// Inner compass: four dials scored 0 (empty) .. 3 (full). We point at the lowest one.
const COMPASS_DIALS = ['energy', 'calm', 'connection', 'hope'];
const COMPASS_ADVICE = {
  energy: { title: 'Your energy is running low', text: 'Rest counts as progress. A slow wind-down tonight could refill the tank.', route: '/pocket/winddown' },
  calm: { title: 'Calm is your lowest dial', text: 'Your body may be holding a lot. A long exhale is the fastest way to turn it down.', route: '/breathe?technique=478' },
  connection: { title: 'You could use some connection', text: 'Talking things through helps. Sol is here, and so is anyone you trust.', route: '/chat/new' },
  hope: { title: 'Hope feels dim right now', text: 'Hope grows from tiny wins. Name three small things from today in your gratitude jar.', route: '/pocket/gratitude' },
};

// Light (the currency that grows the garden). Capped sources can't be farmed.
const LIGHT = { breathe: 15, mood: 10, compass: 20, chat: 5, unload: 10, ground: 10, gratitude: 8, winddown: 10, affirmation: 3 };

const STAGES = [
  { key: 'seed', name: 'Seed', from: 0 },
  { key: 'sprout', name: 'Sprout', from: 40 },
  { key: 'bud', name: 'Bud', from: 120 },
  { key: 'bloom', name: 'Bloom', from: 260 },
  { key: 'grove', name: 'Grove', from: 480 },
];

const KEEPSAKES = [
  { id: 'first_weather', title: 'First forecast', desc: 'Shared your inner weather.' },
  { id: 'first_breath', title: 'First breath', desc: 'Finished a breathing session.' },
  { id: 'first_chat', title: 'Hello, Sol', desc: 'Had your first chat.' },
  { id: 'streak3', title: 'Three days of care', desc: 'A 3-day streak.' },
  { id: 'streak7', title: 'A whole week', desc: 'A 7-day streak.' },
  { id: 'breath10', title: 'Steady breather', desc: '10 breathing sessions.' },
  { id: 'letgo', title: 'Let it go', desc: 'Released a worry in Unload.' },
  { id: 'jar5', title: 'Full of good', desc: '5 gratitude jar notes.' },
  { id: 'sprout', title: 'It sprouted', desc: 'Your garden reached Sprout.' },
];

const CRISIS_PATTERN = /(kill myself|end my life|want to die|suicid|self[- ]?harm|hurt myself|cut myself|don'?t want to (be here|live)|no reason to live|better off (dead|without me)|ending it all)/i;

module.exports = {
  AFFIRMATIONS, DEFAULT_REMINDERS, WEATHER, COMPASS_DIALS, COMPASS_ADVICE, LIGHT, STAGES, KEEPSAKES, CRISIS_PATTERN,
};
