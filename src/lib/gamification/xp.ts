import { db } from "@/lib/db";

/**
 * XP (tajriba ballari).
 *
 * PRINTSIP: XP qiyinchilik va HARAKAT uchun beriladi, faqat to'g'ri javob
 * uchun emas. Zaif o'quvchi ham ilgarilashi kerak — aks holda u birinchi
 * haftadayoq platformani tashlab ketadi.
 */

/** level = floor(sqrt(totalXp / 100)) + 1 → 1-daraja 0, 2-daraja 100, 3-daraja 400 XP */
export function levelFromXp(totalXp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, totalXp) / 100)) + 1;
}

/** Shu darajaga yetish uchun kerak bo'lgan XP. */
export function xpForLevel(level: number): number {
  return Math.pow(level - 1, 2) * 100;
}

/** Keyingi darajagacha qolgan XP va foiz. */
export function levelProgress(totalXp: number) {
  const level = levelFromXp(totalXp);
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = next - current;
  return {
    level,
    current: totalXp - current,
    needed: span,
    percent: span > 0 ? Math.round(((totalXp - current) / span) * 100) : 0,
    nextLevelAt: next,
  };
}

export type XpReason =
  | "assignment_solved"
  | "assignment_partial"
  | "quiz_completed"
  | "practice_bonus"
  | "streak_7"
  | "streak_30"
  | "streak_100"
  | "first_topic"
  | "badge";

/** Ikki marta XP berilmasligi uchun tekshiruv. */
async function alreadyAwarded(
  userId: string,
  reason: XpReason,
  refId: string
): Promise<boolean> {
  const existing = await db.xpEvent.findFirst({
    where: { userId, reason, refId },
    select: { id: true },
  });
  return Boolean(existing);
}

async function award(
  userId: string,
  amount: number,
  reason: XpReason,
  refId?: string
): Promise<number> {
  if (amount <= 0) return 0;
  if (refId && (await alreadyAwarded(userId, reason, refId))) return 0;

  await db.xpEvent.create({
    data: { userId, amount, reason, refId },
  });
  return amount;
}

/**
 * Vazifa yechilgani uchun XP.
 *
 * base = qiyinlik × 20
 *   × urinish koeffitsiyenti (1-urinish 1.0, 2-3 0.9, 4+ 0.8)
 *   × sifat koeffitsiyenti (kod sifati ≥ 80 → 1.15)
 *   × muddat koeffitsiyenti (erta 1.1, kech 0.7)
 *   × mashq koeffitsiyenti (zaif mavzu ustida ishlash → 1.25)
 */
export async function awardForSubmission(submissionId: string): Promise<number> {
  const s = await db.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      attemptNo: true,
      testsPassed: true,
      testsTotal: true,
      isLate: true,
      submittedAt: true,
      assignment: { select: { id: true, difficulty: true, topicId: true } },
      aiReview: { select: { codeQuality: true, status: true } },
    },
  });
  if (!s || s.testsTotal === 0) return 0;

  const ratio = s.testsPassed / s.testsTotal;
  // Umuman o'tmagan bo'lsa ham urinish uchun kichik XP — harakat
  // rag'batlantiriladi, aks holda o'quvchi qayta urinmaydi.
  if (ratio === 0) {
    return award(s.studentId, 5, "assignment_partial", s.id);
  }

  let xp = s.assignment.difficulty * 20 * ratio;

  xp *= s.attemptNo === 1 ? 1 : s.attemptNo <= 3 ? 0.9 : 0.8;

  if (s.aiReview?.status === "DONE" && (s.aiReview.codeQuality ?? 0) >= 80) {
    xp *= 1.15;
  }

  if (s.isLate) xp *= 0.7;

  // Zaif mavzu ustida ishlash qo'shimcha rag'batlantiriladi
  const practiceTarget = await db.assignmentTarget.findFirst({
    where: {
      assignmentId: s.assignment.id,
      userId: s.studentId,
      reason: { not: null },
    },
    select: { id: true, dueAt: true },
  });
  if (practiceTarget) xp *= 1.25;

  // Muddatdan bir kun oldin topshirgan bo'lsa bonus
  if (practiceTarget?.dueAt && s.submittedAt) {
    const hoursEarly =
      (practiceTarget.dueAt.getTime() - s.submittedAt.getTime()) / 3600000;
    if (hoursEarly >= 24) xp *= 1.1;
  }

  const total = await award(
    s.studentId,
    Math.round(xp),
    ratio === 1 ? "assignment_solved" : "assignment_partial",
    s.id
  );

  // Yangi mavzu birinchi marta ochilganda
  if (ratio === 1) {
    const solvedBefore = await db.submission.count({
      where: {
        studentId: s.studentId,
        assignment: { topicId: s.assignment.topicId },
        testsPassed: { gt: 0 },
        id: { not: s.id },
      },
    });
    if (solvedBefore === 0) {
      await award(s.studentId, 30, "first_topic", s.assignment.topicId);
    }
  }

  return total;
}

/** Test (quiz) uchun XP: har to'g'ri javob 5 XP, 100% uchun +20 bonus. */
export async function awardForQuiz(attemptId: string): Promise<number> {
  const a = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      studentId: true,
      score: true,
      maxScore: true,
      answers: { select: { isCorrect: true } },
    },
  });
  if (!a) return 0;

  const correct = a.answers.filter((x) => x.isCorrect === true).length;
  let xp = correct * 5;

  if (a.maxScore && a.score === a.maxScore && a.maxScore > 0) xp += 20;
  // Ishlagani uchun minimal XP
  if (xp === 0) xp = 3;

  return award(a.studentId, xp, "quiz_completed", a.id);
}

export async function totalXp(userId: string): Promise<number> {
  const agg = await db.xpEvent.aggregate({
    where: { userId },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

/** Haftalik XP — reyting shu bo'yicha (umumiy XP emas). */
export async function weeklyXp(userId: string): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const agg = await db.xpEvent.aggregate({
    where: { userId, createdAt: { gte: since } },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}
