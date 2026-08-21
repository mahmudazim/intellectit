import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type TopicSeed = {
  slug: string;
  name: string;
  description: string;
  difficulty: number;
  prereqSlugs?: string[];
};

type ModuleSeed = {
  slug: string;
  name: string;
  track: "PYTHON" | "HTML_CSS" | "JAVASCRIPT" | "WEB" | "AI" | "CYBER";
  topics: TopicSeed[];
};

// ============================================================
// O'quv dasturi — o'qituvchi keyinchalik panel orqali tahrirlaydi
// ============================================================
export const CURRICULUM: ModuleSeed[] = [
  {
    slug: "python-asoslari",
    name: "Python asoslari",
    track: "PYTHON",
    topics: [
      {
        slug: "kirish-chiqish",
        name: "Kirish va chiqish (print, input)",
        description: "Ekranga ma'lumot chiqarish va foydalanuvchidan qabul qilish.",
        difficulty: 1,
      },
      {
        slug: "ozgaruvchilar-turlar",
        name: "O'zgaruvchilar va ma'lumot turlari",
        description: "int, float, str, bool; turlarni o'zgartirish (int(), str()).",
        difficulty: 1,
        prereqSlugs: ["kirish-chiqish"],
      },
      {
        slug: "arifmetika",
        name: "Arifmetik amallar",
        description: "+, -, *, /, //, %, ** va amallar tartibi.",
        difficulty: 1,
        prereqSlugs: ["ozgaruvchilar-turlar"],
      },
      {
        slug: "shartlar",
        name: "Shart operatorlari (if / elif / else)",
        description: "Taqqoslash, mantiqiy amallar (and, or, not), ichma-ich shartlar.",
        difficulty: 2,
        prereqSlugs: ["ozgaruvchilar-turlar"],
      },
      {
        slug: "sikllar-for",
        name: "for sikli va range()",
        description: "Takrorlash, range() chegaralari, qadam bilan yurish.",
        difficulty: 2,
        prereqSlugs: ["shartlar"],
      },
      {
        slug: "sikllar-while",
        name: "while sikli, break va continue",
        description: "Shartli takrorlash, cheksiz sikldan qochish.",
        difficulty: 2,
        prereqSlugs: ["sikllar-for"],
      },
      {
        slug: "satrlar",
        name: "Satrlar bilan ishlash",
        description: "Indeks, kesish (slicing), upper/lower/split/join/replace, f-string.",
        difficulty: 2,
        prereqSlugs: ["ozgaruvchilar-turlar"],
      },
      {
        slug: "royxatlar",
        name: "Ro'yxatlar (list)",
        description: "append, insert, pop, sort, indeks, kesish, ro'yxat bo'ylab yurish.",
        difficulty: 2,
        prereqSlugs: ["sikllar-for"],
      },
      {
        slug: "funksiyalar",
        name: "Funksiyalar (def, return)",
        description: "Parametrlar, qaytariladigan qiymat, standart qiymatlar, ko'rinish sohasi.",
        difficulty: 3,
        prereqSlugs: ["sikllar-for", "royxatlar"],
      },
      {
        slug: "lugatlar-toplamlar",
        name: "Lug'atlar va to'plamlar (dict, set)",
        description: "Kalit-qiymat, items/keys/values, takrorlanmas elementlar.",
        difficulty: 3,
        prereqSlugs: ["royxatlar"],
      },
      {
        slug: "xatolar",
        name: "Xatolarni ushlash (try / except)",
        description: "Xato turlari, traceback o'qish, xatoni to'g'ri qayta ishlash.",
        difficulty: 3,
        prereqSlugs: ["funksiyalar"],
      },
      {
        slug: "fayllar",
        name: "Fayllar bilan ishlash",
        description: "open, read, write, with bloki, matn fayllarni qayta ishlash.",
        difficulty: 3,
        prereqSlugs: ["funksiyalar", "xatolar"],
      },
      {
        slug: "modullar",
        name: "Modullar va standart kutubxona",
        description: "import, math/random/datetime, o'z modulini yozish.",
        difficulty: 3,
        prereqSlugs: ["funksiyalar"],
      },
    ],
  },
  {
    slug: "python-chuqurroq",
    name: "Python — chuqurroq",
    track: "PYTHON",
    topics: [
      {
        slug: "oop-asoslari",
        name: "Obyektga yo'naltirilgan dasturlash",
        description: "class, __init__, atribut va metodlar, obyekt yaratish.",
        difficulty: 4,
        prereqSlugs: ["funksiyalar", "lugatlar-toplamlar"],
      },
      {
        slug: "algoritmlar-qidiruv",
        name: "Qidiruv va saralash algoritmlari",
        description: "Chiziqli va binar qidiruv, sodda saralash, murakkablik tushunchasi.",
        difficulty: 4,
        prereqSlugs: ["royxatlar", "funksiyalar"],
      },
      {
        slug: "rekursiya",
        name: "Rekursiya",
        description: "O'zini chaqiruvchi funksiyalar, bazaviy holat, stack.",
        difficulty: 4,
        prereqSlugs: ["funksiyalar"],
      },
    ],
  },
  {
    slug: "html-asoslari",
    name: "HTML asoslari",
    track: "HTML_CSS",
    topics: [
      {
        slug: "html-tuzilma",
        name: "HTML hujjat tuzilishi",
        description: "<!DOCTYPE>, html, head, body, meta, title.",
        difficulty: 1,
      },
      {
        slug: "matn-teglari",
        name: "Matn teglari",
        description: "h1–h6, p, strong, em, br, hr — mazmunga mos teg tanlash.",
        difficulty: 1,
        prereqSlugs: ["html-tuzilma"],
      },
      {
        slug: "royxat-jadval",
        name: "Ro'yxatlar va jadvallar",
        description: "ul, ol, li, dl; table, tr, th, td.",
        difficulty: 2,
        prereqSlugs: ["matn-teglari"],
      },
      {
        slug: "havola-rasm",
        name: "Havolalar va rasmlar",
        description: "a (href, target), img (src, alt) — alt nima uchun kerak.",
        difficulty: 2,
        prereqSlugs: ["matn-teglari"],
      },
      {
        slug: "formalar",
        name: "Formalar",
        description: "form, input turlari, label, select, textarea, button.",
        difficulty: 3,
        prereqSlugs: ["havola-rasm"],
      },
      {
        slug: "semantik-html",
        name: "Semantik HTML",
        description: "header, nav, main, section, article, aside, footer — nega muhim.",
        difficulty: 3,
        prereqSlugs: ["royxat-jadval", "havola-rasm"],
      },
    ],
  },
  {
    slug: "css-asoslari",
    name: "CSS asoslari",
    track: "HTML_CSS",
    topics: [
      {
        slug: "css-ulash-selektorlar",
        name: "CSS ulash va selektorlar",
        description: "link/style, teg/class/id selektorlari, kaskad va ustunlik.",
        difficulty: 2,
        prereqSlugs: ["html-tuzilma"],
      },
      {
        slug: "css-rang-shrift",
        name: "Ranglar va shriftlar",
        description: "color, background, font-family/size/weight, matn tekislash.",
        difficulty: 2,
        prereqSlugs: ["css-ulash-selektorlar"],
      },
      {
        slug: "box-model",
        name: "Box model",
        description: "margin, border, padding, width/height, box-sizing.",
        difficulty: 3,
        prereqSlugs: ["css-ulash-selektorlar"],
      },
      {
        slug: "flexbox",
        name: "Flexbox",
        description: "display:flex, justify-content, align-items, gap, flex-wrap.",
        difficulty: 3,
        prereqSlugs: ["box-model"],
      },
      {
        slug: "css-grid",
        name: "CSS Grid",
        description: "grid-template-columns, gap, grid-area — murakkab joylashuv.",
        difficulty: 4,
        prereqSlugs: ["flexbox"],
      },
      {
        slug: "responsive",
        name: "Moslashuvchan dizayn (responsive)",
        description: "media query, nisbiy o'lchovlar, mobile-first yondashuv.",
        difficulty: 4,
        prereqSlugs: ["flexbox"],
      },
      {
        slug: "css-animatsiya",
        name: "O'tish va animatsiyalar",
        description: "transition, transform, @keyframes, hover effektlari.",
        difficulty: 4,
        prereqSlugs: ["box-model"],
      },
    ],
  },
];

// ============================================================
// Nishonlar
// ============================================================
export const BADGES = [
  {
    slug: "first-step",
    name: "Birinchi qadam",
    description: "Birinchi vazifangizni yechdingiz.",
    icon: "footprints",
    tier: 1,
    ruleJson: { type: "solved_count", count: 1 },
  },
  {
    slug: "persistent",
    name: "Qat'iyat",
    description: "3 martadan ko'p urinib, oxirida yechdingiz.",
    icon: "repeat",
    tier: 1,
    ruleJson: { type: "solved_after_attempts", minAttempts: 4 },
  },
  {
    slug: "clean-code",
    name: "Toza kod",
    description: "Kod sifati 90 balldan yuqori baholandi.",
    icon: "sparkles",
    tier: 2,
    ruleJson: { type: "code_quality", min: 90 },
  },
  {
    slug: "flawless-5",
    name: "Mukammal",
    description: "5 marta birinchi urinishda barcha testlardan o'tdingiz.",
    icon: "target",
    tier: 2,
    ruleJson: { type: "first_try_all_pass", count: 5 },
  },
  {
    slug: "early-bird-10",
    name: "Erta qush",
    description: "10 marta muddatdan bir kun oldin topshirdingiz.",
    icon: "sunrise",
    tier: 2,
    ruleJson: { type: "early_submit", hoursBefore: 24, count: 10 },
  },
  {
    slug: "streak-7",
    name: "Bir hafta uzluksiz",
    description: "7 kun ketma-ket mashq qildingiz.",
    icon: "flame",
    tier: 1,
    ruleJson: { type: "streak", days: 7 },
  },
  {
    slug: "streak-30",
    name: "Marafonchi",
    description: "30 kun ketma-ket mashq qildingiz.",
    icon: "flame",
    tier: 3,
    ruleJson: { type: "streak", days: 30 },
  },
  {
    slug: "python-master",
    name: "Python ustasi",
    description: "Python yo'nalishidagi barcha mavzularni o'zlashtirdingiz.",
    icon: "crown",
    tier: 3,
    ruleJson: { type: "track_mastery", track: "PYTHON", min: 0.8 },
  },
  {
    slug: "web-master",
    name: "Web ustasi",
    description: "HTML va CSS mavzularini o'zlashtirdingiz.",
    icon: "crown",
    tier: 3,
    ruleJson: { type: "track_mastery", track: "HTML_CSS", min: 0.8 },
  },
  {
    slug: "comeback",
    name: "Kamchilikni yengdi",
    description: "Zaif mavzuni mustahkam darajaga ko'tardingiz.",
    icon: "trending-up",
    tier: 2,
    ruleJson: { type: "mastery_comeback", from: 0.4, to: 0.75 },
  },
  {
    slug: "night-owl",
    name: "Tungi bo'ri",
    description: "Yarim tundan keyin vazifa yechdingiz.",
    icon: "moon",
    tier: 1,
    ruleJson: { type: "submit_hour_range", from: 0, to: 4 },
  },
  {
    slug: "early-riser",
    name: "Saharxez",
    description: "Tong saharda vazifa yechdingiz.",
    icon: "sun",
    tier: 1,
    ruleJson: { type: "submit_hour_range", from: 5, to: 7 },
  },
];

export async function runSeed() {
  console.log("Seed boshlandi...");

  // ---------- 1. O'qituvchi ----------
  const username = (process.env.SEED_TEACHER_USERNAME ?? "ustoz").toLowerCase();
  const password = process.env.SEED_TEACHER_PASSWORD ?? "ozgartiring123";
  const fullName = process.env.SEED_TEACHER_NAME ?? "O'qituvchi";

  const teacher = await db.user.upsert({
    where: { username },
    update: { role: "TEACHER", fullName, isActive: true },
    create: {
      username,
      fullName,
      role: "TEACHER",
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePw: false,
      notificationPref: { create: {} },
      streak: { create: {} },
    },
  });
  console.log(`  o'qituvchi: ${teacher.username}`);

  // ---------- 2. O'quv dasturi ----------
  let topicCount = 0;
  for (const [mIndex, mod] of CURRICULUM.entries()) {
    const dbModule = await db.module.upsert({
      where: { slug: mod.slug },
      update: { name: mod.name, track: mod.track, order: mIndex },
      create: { slug: mod.slug, name: mod.name, track: mod.track, order: mIndex },
    });

    for (const [tIndex, topic] of mod.topics.entries()) {
      await db.topic.upsert({
        where: { slug: topic.slug },
        update: {
          name: topic.name,
          description: topic.description,
          difficulty: topic.difficulty,
          prereqSlugs: topic.prereqSlugs ?? [],
          order: tIndex,
          moduleId: dbModule.id,
        },
        create: {
          slug: topic.slug,
          name: topic.name,
          description: topic.description,
          difficulty: topic.difficulty,
          prereqSlugs: topic.prereqSlugs ?? [],
          order: tIndex,
          moduleId: dbModule.id,
        },
      });
      topicCount += 1;
    }
  }
  console.log(`  modullar: ${CURRICULUM.length}, mavzular: ${topicCount}`);

  // ---------- 3. Nishonlar ----------
  for (const badge of BADGES) {
    await db.badge.upsert({
      where: { slug: badge.slug },
      update: badge,
      create: badge,
    });
  }
  console.log(`  nishonlar: ${BADGES.length}`);

  // ---------- 4. Namuna guruhlar ----------
  for (const g of [
    { name: "9-A sinf (IT)", kind: "SCHOOL_CLASS" as const },
    { name: "Python to'garak", kind: "CLUB" as const },
  ]) {
    const exists = await db.group.findFirst({ where: { name: g.name } });
    if (!exists) await db.group.create({ data: g });
  }
  console.log("  namuna guruhlar tayyor");

  console.log("Seed tugadi.");
}

// import.meta.url uchraydigan "file://" solishtirish Windows'da (drive-letter
// URL'lari uch chiziqchali: file:///C:/...) ishlamaydi — shuning uchun ikkalasi
// ham haqiqiy fayl yo'liga aylantiriladi.
const isDirectRun =
  !!process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  runSeed()
    .catch((e) => {
      console.error("Seed xatosi:", e);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
