import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const affirmations = [
  { text: "You are allowed to take up space today.", category: "self-worth" },
  { text: "Small steps still move you forward.", category: "growth" },
  { text: "Your feelings are valid, even the quiet ones.", category: "emotion" },
  { text: "Rest is productive. You don't have to earn it.", category: "rest" },
  { text: "You've survived every hard day so far.", category: "resilience" },
  { text: "It's okay to begin again, gently.", category: "growth" },
  { text: "You are more than what you produce.", category: "self-worth" },
  { text: "Breathe. You are here, and that is enough.", category: "grounding" },
  { text: "Your pace is the right pace for you.", category: "self-worth" },
  { text: "You deserve the same kindness you give to others.", category: "self-worth" },
  { text: "Not every day has to be a good day to be a worthwhile one.", category: "emotion" },
  { text: "You can hold hard feelings and still be gentle with yourself.", category: "emotion" },
  { text: "Asking for help is a strong thing to do.", category: "resilience" },
  { text: "This moment is enough. You don't have to solve everything today.", category: "grounding" },
  { text: "Progress can be quiet and still be real.", category: "growth" },
];

const activities = [
  { slug: "box-breathing", title: "Box Breathing", description: "A calming 4-4-4-4 rhythm to steady your breath.", duration: 4, category: "breathing" },
  { slug: "478-breathing", title: "4-7-8 Breathing", description: "Slow exhales to help your body settle.", duration: 5, category: "breathing" },
  { slug: "gratitude-3", title: "Three Good Things", description: "Write down three small good moments from today.", duration: 5, category: "reflection" },
  { slug: "body-scan", title: "2-Minute Body Scan", description: "Notice what your body is holding, without judgment.", duration: 2, category: "mindfulness" },
  { slug: "self-kindness-note", title: "Self-Kindness Note", description: "Write a short, kind note to yourself.", duration: 5, category: "reflection" },
];

async function main() {
  for (const a of affirmations) {
    const exists = await prisma.affirmation.findFirst({ where: { text: a.text } });
    if (!exists) await prisma.affirmation.create({ data: a });
  }
  for (const act of activities) {
    await prisma.wellnessActivity.upsert({
      where: { slug: act.slug },
      update: {},
      create: act,
    });
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());