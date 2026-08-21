import { db } from "@/lib/db";

/**
 * Mavzu o'zlashtirish darajasini hisoblash.
 *
 * Model: har bir (o'quvchi, mavzu) juftligi uchun score ∈ [0,1].
 * Yangilanish — eksponensial siljuvchi o'rtacha (EWMA):
 *
 *     score_yangi = score + α × (natija − score),   α = 0.35 × og'irlik
 *
 * Nega EWMA: oxirgi natijalar ko'proq ta'sir qiladi, lekin bitta omadli
 * (yoki omadsiz) javob butun bahoni ag'darib yubormaydi.
 *
 * confidence — nechta dalil borligiga qarab ishonch. Kam dalil bo'lsa
 * "zaif" degan xulosa chiqarilmaydi.
 */

const ALPHA = 0.35;
/** Ishonch to'liq bo'lishi uchun kerakli dalillar soni */
const CONFIDENCE_FULL = 5;

export type EvidenceSource =
  | "submission"
  | "quiz"
  | "ai_issue"
  | "decay"
  | "teacher_override";

export type Evidence = {
  topicSlug: string;
  /** 0..1 — bu dalil qanchalik yaxshi natija ko'rsatdi */
  result: number;
  /** 0..1 — dalilning og'irligi (vazifa quizdan og'irroq) */
  weight: number;
  source: EvidenceSource;
  sourceId?: string;
  note?: string;
};

/**
 * Dalillar to'plamini qo'llaydi.
 * Bir mavzuga bir nechta dalil kelsa — ketma-ket qo'llanadi.
 */
export async function applyEvidence(
  userId: string,
  evidence: Evidence[]
): Promise<void> {
  if (evidence.length === 0) return;

  const slugs = [...new Set(evidence.map((e) => e.topicSlug))];
  const topics = await db.topic.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(topics.map((t) => [t.slug, t.id]));

  for (const ev of evidence) {
    const topicId = idBySlug.get(ev.topicSlug);
    if (!topicId) continue; // noma'lum mavzu — e'tiborsiz qoldiramiz

    const current = await db.topicMastery.findUnique({
      where: { userId_topicId: { userId, topicId } },
      select: { score: true, evidenceCount: true },
    });

    const before = current?.score ?? 0;
    const count = (current?.evidenceCount ?? 0) + 1;

    const alpha = Math.min(1, ALPHA * ev.weight);
    // Birinchi dalil bo'lsa — to'g'ridan-to'g'ri natijani olamiz,
    // aks holda 0 dan sekin ko'tarilib, haqiqatni kech ko'rsatadi.
    const after =
      current === null ? ev.result : before + alpha * (ev.result - before);

    const clamped = Math.max(0, Math.min(1, after));

    await db.topicMastery.upsert({
      where: { userId_topicId: { userId, topicId } },
      create: {
        userId,
        topicId,
        score: clamped,
        evidenceCount: 1,
        confidence: Math.min(1, 1 / CONFIDENCE_FULL),
        lastPracticeAt: new Date(),
      },
      update: {
        score: clamped,
        evidenceCount: count,
        confidence: Math.min(1, count / CONFIDENCE_FULL),
        lastPracticeAt: new Date(),
      },
    });

    // Audit: o'qituvchi "nega bu ball?" degan savolga javob topa olsin
    await db.masteryEvent.create({
      data: {
        userId,
        topicId,
        source: ev.source,
        sourceId: ev.sourceId,
        weight: ev.weight,
        result: ev.result,
        scoreBefore: before,
        scoreAfter: clamped,
        note: ev.note,
      },
    });
  }
}

/**
 * Javob (submission) natijasidan dalillar yig'adi.
 *
 * Ikki manba:
 *  1. Test natijasi → vazifaning asosiy mavzusiga
 *  2. AI aniqlagan xatolar → o'sha xato tegishli mavzuga
 */
export async function applySubmissionEvidence(
  submissionId: string
): Promise<void> {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      attemptNo: true,
      testsPassed: true,
      testsTotal: true,
      isLate: true,
      assignment: { select: { topic: { select: { slug: true } } } },
      aiReview: { select: { status: true, score: true, issues: true } },
    },
  });
  if (!submission) return;

  const evidence: Evidence[] = [];
  const primarySlug = submission.assignment.topic.slug;

  // ---- 1. Asosiy dalil: test natijasi (bo'lsa) yoki AI umumiy bahosi ----
  // HTML_CSS/TEXT/PROJECT kabi avtomatik testi yo'q turlarda obyektiv
  // signal yo'q — AI'ning "score" maydoni yagona manba bo'ladi.
  if (submission.testsTotal > 0) {
    const ratio = submission.testsPassed / submission.testsTotal;
    let result: number;
    let weight: number;

    if (ratio === 1) {
      // Birinchi urinishda to'liq yechgan — eng kuchli dalil
      result = submission.attemptNo === 1 ? 1 : submission.attemptNo <= 3 ? 0.85 : 0.75;
      weight = 1;
    } else if (ratio === 0) {
      result = 0;
      weight = 1;
    } else {
      result = ratio;
      weight = 0.8;
    }

    // Muddatdan keyin topshirgan bo'lsa biroz kamayadi
    if (submission.isLate) result *= 0.9;

    evidence.push({
      topicSlug: primarySlug,
      result,
      weight,
      source: "submission",
      sourceId: submission.id,
      note: `${submission.testsPassed}/${submission.testsTotal} test, ${submission.attemptNo}-urinish`,
    });
  } else if (submission.aiReview?.status === "DONE" && submission.aiReview.score !== null) {
    let result = submission.aiReview.score / 100;
    if (submission.isLate) result *= 0.9;

    evidence.push({
      topicSlug: primarySlug,
      result,
      // Avtomatik testdan yengilroq dalil — AI bahosi sub'ektivroq
      weight: 0.6,
      source: "submission",
      sourceId: submission.id,
      note: `AI baho: ${submission.aiReview.score}/100 (avtomatik test yo'q)`,
    });
  }

  // ---- 2. AI aniqlagan xatolar ----
  if (submission.aiReview?.status === "DONE" && submission.aiReview.issues) {
    const issues = submission.aiReview.issues as {
      topicSlug: string;
      severity: string;
    }[];

    // Bir mavzuda bir nechta xato bo'lsa — eng jiddiysini olamiz
    const worstByTopic = new Map<string, string>();
    const rank = { critical: 3, major: 2, minor: 1, style: 0 } as const;

    for (const issue of issues) {
      // Vazifaning asosiy mavzusi allaqachon test natijasidan baholandi
      if (issue.topicSlug === primarySlug) continue;
      const prev = worstByTopic.get(issue.topicSlug);
      const prevRank = prev ? (rank[prev as keyof typeof rank] ?? 0) : -1;
      const curRank = rank[issue.severity as keyof typeof rank] ?? 0;
      if (curRank > prevRank) worstByTopic.set(issue.topicSlug, issue.severity);
    }

    const SEVERITY_EVIDENCE: Record<string, { result: number; weight: number }> = {
      critical: { result: 0, weight: 0.9 },
      major: { result: 0.3, weight: 0.6 },
      minor: { result: 0.6, weight: 0.3 },
      style: { result: 0.7, weight: 0.2 },
    };

    for (const [slug, severity] of worstByTopic) {
      const e = SEVERITY_EVIDENCE[severity] ?? SEVERITY_EVIDENCE.minor;
      evidence.push({
        topicSlug: slug,
        result: e.result,
        weight: e.weight,
        source: "ai_issue",
        sourceId: submission.id,
        note: `AI: ${severity}`,
      });
    }
  }

  await applyEvidence(submission.studentId, evidence);
}

/** Test (quiz) urinishidan dalillar yig'adi. */
export async function applyQuizEvidence(attemptId: string): Promise<void> {
  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      studentId: true,
      answers: {
        select: {
          isCorrect: true,
          question: { select: { topic: { select: { slug: true } } } },
        },
      },
    },
  });
  if (!attempt) return;

  // Bir mavzudagi barcha savollarni birlashtiramiz —
  // 5 ta savol 5 ta alohida dalil emas, bitta ishonchli dalil
  const byTopic = new Map<string, { correct: number; total: number }>();
  for (const a of attempt.answers) {
    if (a.isCorrect === null) continue; // AI hali baholamagan
    const slug = a.question.topic.slug;
    const cur = byTopic.get(slug) ?? { correct: 0, total: 0 };
    cur.total += 1;
    if (a.isCorrect) cur.correct += 1;
    byTopic.set(slug, cur);
  }

  const evidence: Evidence[] = [...byTopic].map(([slug, s]) => ({
    topicSlug: slug,
    result: s.correct / s.total,
    // Quiz vazifadan yengilroq dalil, lekin savol ko'p bo'lsa ishonchliroq
    weight: Math.min(0.7, 0.35 + s.total * 0.12),
    source: "quiz" as const,
    sourceId: attempt.id,
    note: `${s.correct}/${s.total} savol`,
  }));

  await applyEvidence(attempt.studentId, evidence);
}

/**
 * Unutish (decay). Uzoq vaqt mashq qilinmagan mavzu bahosi sekin pasayadi.
 *
 * Nega kerak: o'quvchi sentabrda "sikllar" ni o'zlashtirgan bo'lishi mumkin,
 * lekin dekabrda unutgan bo'ladi. Takrorlashni rag'batlantiradi.
 *
 * Har kecha cron chaqiradi.
 */
export async function applyDecay(): Promise<{ updated: number }> {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - 30);

  const stale = await db.topicMastery.findMany({
    where: {
      lastPracticeAt: { lt: threshold },
      score: { gt: 0.3 }, // 0.3 dan pastga tushirmaymiz
    },
    select: { id: true, userId: true, topicId: true, score: true, lastPracticeAt: true },
    take: 2000,
  });

  let updated = 0;
  const now = Date.now();

  for (const m of stale) {
    const weeksStale = Math.floor(
      (now - (m.lastPracticeAt?.getTime() ?? now)) / (7 * 24 * 3600 * 1000)
    );
    if (weeksStale < 5) continue; // 30 kundan keyin boshlanadi

    // Haftasiga 3% pasayish
    const factor = Math.pow(0.97, weeksStale - 4);
    const after = Math.max(0.3, m.score * factor);
    if (Math.abs(after - m.score) < 0.005) continue;

    await db.topicMastery.update({
      where: { id: m.id },
      data: { score: after },
    });
    await db.masteryEvent.create({
      data: {
        userId: m.userId,
        topicId: m.topicId,
        source: "decay",
        weight: 0,
        result: after,
        scoreBefore: m.score,
        scoreAfter: after,
        note: `${weeksStale} hafta mashq qilinmadi`,
      },
    });
    updated += 1;
  }

  return { updated };
}
