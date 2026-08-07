import { db } from "@/lib/db";
import type { QuestionType } from "@/generated/prisma/enums";

/** Savol variantining shakli (Question.options JSON maydonida saqlanadi). */
export type QuestionOption = { id: string; text: string; isCorrect: boolean };

/** O'quvchi javobi (QuizAnswer.answerJson). */
export type StudentAnswer =
  | { type: "choice"; optionIds: string[] }
  | { type: "text"; value: string };

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  MCQ_SINGLE: "Bitta to'g'ri javob",
  MCQ_MULTI: "Bir nechta to'g'ri javob",
  TRUE_FALSE: "To'g'ri / Noto'g'ri",
  SHORT_ANSWER: "Qisqa javob",
  CODE_OUTPUT: "Kod natijasi",
  FILL_BLANK: "Bo'sh joyni to'ldirish",
};

/** Matnli javoblarni solishtirish uchun normallashtirish. */
export function normalizeText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    // O'zbekcha apostroflarning turli ko'rinishlari bir xil hisoblansin
    .replace(/[''`ʻʼ']/g, "'");
}

/**
 * Bitta savolni baholaydi.
 *
 * SHORT_ANSWER uchun avval aniq moslik tekshiriladi; mos kelmasa
 * `needsAi: true` qaytariladi va AI baholaydi (Bosqich 2 dagi router orqali).
 * Boshqa turlar to'liq deterministik — AI kerak emas.
 */
export function gradeAnswer(
  question: {
    type: QuestionType;
    options: unknown;
    correctText: string | null;
    points: number;
  },
  answer: StudentAnswer | null
): { isCorrect: boolean | null; points: number; needsAi: boolean } {
  if (!answer) return { isCorrect: false, points: 0, needsAi: false };

  switch (question.type) {
    case "MCQ_SINGLE":
    case "TRUE_FALSE": {
      if (answer.type !== "choice") return { isCorrect: false, points: 0, needsAi: false };
      const opts = (question.options as QuestionOption[] | null) ?? [];
      const correct = opts.find((o) => o.isCorrect);
      const ok = Boolean(correct && answer.optionIds[0] === correct.id);
      return { isCorrect: ok, points: ok ? question.points : 0, needsAi: false };
    }

    case "MCQ_MULTI": {
      if (answer.type !== "choice") return { isCorrect: false, points: 0, needsAi: false };
      const opts = (question.options as QuestionOption[] | null) ?? [];
      const correctIds = new Set(opts.filter((o) => o.isCorrect).map((o) => o.id));
      const chosen = new Set(answer.optionIds);
      // To'liq moslik talab qilinadi: ortiqcha tanlangan ham xato
      const ok =
        correctIds.size === chosen.size &&
        [...correctIds].every((id) => chosen.has(id));
      return { isCorrect: ok, points: ok ? question.points : 0, needsAi: false };
    }

    case "CODE_OUTPUT":
    case "FILL_BLANK": {
      if (answer.type !== "text") return { isCorrect: false, points: 0, needsAi: false };
      // Bir nechta to'g'ri variant "|" bilan ajratiladi
      const accepted = (question.correctText ?? "")
        .split("|")
        .map(normalizeText)
        .filter(Boolean);
      const ok = accepted.includes(normalizeText(answer.value));
      return { isCorrect: ok, points: ok ? question.points : 0, needsAi: false };
    }

    case "SHORT_ANSWER": {
      if (answer.type !== "text") return { isCorrect: false, points: 0, needsAi: false };
      const accepted = (question.correctText ?? "")
        .split("|")
        .map(normalizeText)
        .filter(Boolean);
      if (accepted.includes(normalizeText(answer.value))) {
        return { isCorrect: true, points: question.points, needsAi: false };
      }
      // Aniq mos kelmadi — AI mazmunan to'g'riligini baholaydi
      return { isCorrect: null, points: 0, needsAi: true };
    }

    default:
      return { isCorrect: false, points: 0, needsAi: false };
  }
}

/** Shu o'quvchiga berilgan testlar. */
export async function getStudentQuizzes(studentId: string) {
  const memberships = await db.groupMember.findMany({
    where: { userId: studentId },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const quizzes = await db.quiz.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      timeLimitMin: true,
      maxAttempts: true,
      isDiagnostic: true,
      dueAt: true,
      targets: true,
      _count: { select: { items: true } },
    },
  });

  // Manzil JSON'da saqlanadi: { groupIds: [], userIds: [] }
  const visible = quizzes.filter((q) => {
    const t = (q.targets ?? {}) as { groupIds?: string[]; userIds?: string[] };
    const toGroup = (t.groupIds ?? []).some((g) => groupIds.includes(g));
    const toUser = (t.userIds ?? []).includes(studentId);
    return toGroup || toUser;
  });

  const attempts = await db.quizAttempt.findMany({
    where: { studentId, quizId: { in: visible.map((q) => q.id) } },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      quizId: true,
      attemptNo: true,
      score: true,
      maxScore: true,
      submittedAt: true,
    },
  });

  return visible.map((q) => {
    const mine = attempts.filter((a) => a.quizId === q.id);
    return {
      ...q,
      attempts: mine,
      bestScore: mine.reduce<number | null>(
        (best, a) => (a.score !== null && (best === null || a.score > best) ? a.score : best),
        null
      ),
      canAttempt: mine.filter((a) => a.submittedAt).length < q.maxAttempts,
    };
  });
}

/** Shu o'quvchi shu testga kira oladimi? */
export async function canStudentAccessQuiz(
  studentId: string,
  quizId: string
): Promise<boolean> {
  const quiz = await db.quiz.findFirst({
    where: { id: quizId, status: "PUBLISHED" },
    select: { targets: true },
  });
  if (!quiz) return false;

  const t = (quiz.targets ?? {}) as { groupIds?: string[]; userIds?: string[] };
  if ((t.userIds ?? []).includes(studentId)) return true;

  const memberships = await db.groupMember.findMany({
    where: { userId: studentId },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);
  return (t.groupIds ?? []).some((g) => groupIds.includes(g));
}
