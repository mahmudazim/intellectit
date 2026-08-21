import { db } from "@/lib/db";

/**
 * Zaif mavzularni aniqlash.
 *
 * Zaif = score < 0.6 VA confidence >= 0.4 (kamida 2 ta dalil).
 * Ishonch yetarli bo'lmasa "aniqlanmagan" deb belgilanadi — bitta omadsiz
 * javob asosida o'quvchiga "sen bu mavzuni bilmaysan" deb aytmaymiz.
 */

const WEAK_THRESHOLD = 0.6;
const MIN_CONFIDENCE = 0.4;
const STRONG_THRESHOLD = 0.8;

export type TopicState = {
  topicId: string;
  slug: string;
  name: string;
  moduleName: string;
  track: string;
  difficulty: number;
  score: number;
  confidence: number;
  evidenceCount: number;
  lastPracticeAt: Date | null;
  status: "strong" | "ok" | "weak" | "unknown";
  /** Zaiflik tartibi uchun — kattaroq = muhimroq */
  priority: number;
  /** Bu mavzudan oldin tuzatilishi kerak bo'lgan mavzu */
  blockedBy: string | null;
};

export async function getTopicStates(userId: string): Promise<TopicState[]> {
  const [topics, mastery] = await Promise.all([
    db.topic.findMany({
      orderBy: [{ module: { order: "asc" } }, { order: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        difficulty: true,
        prereqSlugs: true,
        module: { select: { name: true, track: true } },
      },
    }),
    db.topicMastery.findMany({
      where: { userId },
      select: {
        topicId: true,
        score: true,
        confidence: true,
        evidenceCount: true,
        lastPracticeAt: true,
      },
    }),
  ]);

  const byTopicId = new Map(mastery.map((m) => [m.topicId, m]));

  const states: TopicState[] = topics.map((t) => {
    const m = byTopicId.get(t.id);
    const score = m?.score ?? 0;
    const confidence = m?.confidence ?? 0;

    let status: TopicState["status"];
    if (!m || confidence < MIN_CONFIDENCE) status = "unknown";
    else if (score >= STRONG_THRESHOLD) status = "strong";
    else if (score < WEAK_THRESHOLD) status = "weak";
    else status = "ok";

    return {
      topicId: t.id,
      slug: t.slug,
      name: t.name,
      moduleName: t.module.name,
      track: t.module.track,
      difficulty: t.difficulty,
      score,
      confidence,
      evidenceCount: m?.evidenceCount ?? 0,
      lastPracticeAt: m?.lastPracticeAt ?? null,
      status,
      // Qanchalik zaif × qanchalik ishonchli × mavzu qanchalik muhim
      priority:
        status === "weak"
          ? (WEAK_THRESHOLD - score) * confidence * (1 + t.difficulty / 5)
          : 0,
      blockedBy: null,
    };
  });

  // ---- Prerekvizit ildizini topish ----
  // O'quvchi "funksiyalar" da qiynalayotgan bo'lsa, lekin undan oldingi
  // "sikllar" ham zaif bo'lsa — avval sikllarni tuzatish kerak.
  const bySlug = new Map(states.map((s) => [s.slug, s]));
  const prereqBySlug = new Map(topics.map((t) => [t.slug, t.prereqSlugs]));

  for (const state of states) {
    if (state.status !== "weak") continue;

    const seen = new Set<string>();
    let cursor = state.slug;

    // Ildizga qadar tushamiz (sikldan himoya bilan)
    while (!seen.has(cursor)) {
      seen.add(cursor);
      const prereqs = prereqBySlug.get(cursor) ?? [];
      const weakPrereq = prereqs
        .map((p) => bySlug.get(p))
        .filter((p): p is TopicState => Boolean(p) && p!.status === "weak")
        .sort((a, b) => b.priority - a.priority)[0];

      if (!weakPrereq) break;
      state.blockedBy = weakPrereq.name;
      cursor = weakPrereq.slug;
    }
  }

  return states;
}

/** Eng muhim zaif mavzular (tartiblangan). */
export async function getWeakTopics(
  userId: string,
  limit = 5
): Promise<TopicState[]> {
  const states = await getTopicStates(userId);
  return states
    .filter((s) => s.status === "weak")
    .sort((a, b) => {
      // Ildiz mavzular (blockedBy yo'q) birinchi — ularni oldin tuzatish kerak
      if (!a.blockedBy && b.blockedBy) return -1;
      if (a.blockedBy && !b.blockedBy) return 1;
      return b.priority - a.priority;
    })
    .slice(0, limit);
}

/**
 * Sinf bo'yicha mavzu holati — o'qituvchi hisoboti uchun.
 *
 * Diqqat: bu yerda MIN_CONFIDENCE bilan filtrlanmaydi. Ishonch chegarasi
 * faqat individual o'quvchiga "sen zaifsan" deb aytishdan saqlaydi
 * (getTopicStates/getWeakTopics). O'qituvchi esa hatto bitta test yoki
 * vazifa natijasini ham darhol ko'rishi kerak — aks holda hisobot
 * bo'sh ko'rinadi va o'qituvchi "test/vazifa berdim, lekin ko'rinmayapti"
 * deb o'ylaydi.
 */
export async function getClassTopicStats(groupId?: string) {
  const students = await db.user.findMany({
    where: {
      role: "STUDENT",
      isActive: true,
      ...(groupId ? { groups: { some: { groupId } } } : {}),
    },
    select: { id: true, fullName: true },
  });
  if (students.length === 0) return { students: [], topics: [] };

  const ids = students.map((s) => s.id);

  const [topics, mastery] = await Promise.all([
    db.topic.findMany({
      orderBy: [{ module: { order: "asc" } }, { order: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        module: { select: { name: true } },
      },
    }),
    db.topicMastery.findMany({
      where: { userId: { in: ids } },
      select: {
        userId: true,
        topicId: true,
        score: true,
        confidence: true,
        evidenceCount: true,
      },
    }),
  ]);

  const key = (u: string, t: string) => `${u}:${t}`;
  const map = new Map(mastery.map((m) => [key(m.userId, m.topicId), m]));

  const topicRows = topics
    .map((t) => {
      // Har qanday dalil hisobga olinadi — MIN_CONFIDENCE bu yerda qo'llanmaydi.
      const scores = students
        .map((s) => map.get(key(s.id, t.id)))
        .filter((m): m is NonNullable<typeof m> => Boolean(m));

      const avg =
        scores.length > 0
          ? scores.reduce((sum, m) => sum + m.score, 0) / scores.length
          : null;

      return {
        topicId: t.id,
        name: t.name,
        slug: t.slug,
        moduleName: t.module.name,
        avgScore: avg,
        weakCount: scores.filter((m) => m.score < WEAK_THRESHOLD).length,
        measuredCount: scores.length,
        perStudent: students.map((s) => {
          const m = map.get(key(s.id, t.id));
          return {
            userId: s.id,
            score: m ? m.score : null,
            lowConfidence: m ? m.confidence < MIN_CONFIDENCE : false,
          };
        }),
      };
    })
    // Hech kim ishlamagan mavzular jadvalni to'ldirmasin
    .filter((t) => t.measuredCount > 0);

  return { students, topics: topicRows };
}
