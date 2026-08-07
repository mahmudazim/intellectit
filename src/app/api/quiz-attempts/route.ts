import { NextResponse, after } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getApiUser } from "@/lib/guards";
import { canStudentAccessQuiz, gradeAnswer, type StudentAnswer } from "@/lib/quiz";
import { gradeShortAnswers } from "@/lib/ai/gradeShortAnswer";
import { applyQuizEvidence } from "@/lib/mastery/update";
import { grantRewards } from "@/lib/gamification";

export const runtime = "nodejs";
export const maxDuration = 60;

const answerSchema = z.union([
  z.object({ type: z.literal("choice"), optionIds: z.array(z.string()).max(8) }),
  z.object({ type: z.literal("text"), value: z.string().max(2000) }),
]);

const bodySchema = z.object({
  quizId: z.string().min(1),
  answers: z.record(z.string(), answerSchema),
  timeSpent: z.record(z.string(), z.number()).optional(),
});

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Avtorizatsiya kerak." }, { status: 401 });
  }
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "Faqat o'quvchi uchun." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 });
  }
  const { quizId, answers, timeSpent } = parsed.data;

  if (!(await canStudentAccessQuiz(user.id, quizId))) {
    return NextResponse.json({ error: "Test topilmadi." }, { status: 404 });
  }

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      maxAttempts: true,
      dueAt: true,
      items: {
        orderBy: { order: "asc" },
        select: {
          question: {
            select: {
              id: true,
              type: true,
              options: true,
              correctText: true,
              points: true,
            },
          },
        },
      },
    },
  });
  if (!quiz) {
    return NextResponse.json({ error: "Test topilmadi." }, { status: 404 });
  }

  const doneAttempts = await db.quizAttempt.count({
    where: { quizId, studentId: user.id, submittedAt: { not: null } },
  });
  if (doneAttempts >= quiz.maxAttempts) {
    return NextResponse.json(
      { error: "Urinishlar soni tugadi." },
      { status: 409 }
    );
  }

  // ---- Baholash ----
  let score = 0;
  let maxScore = 0;
  const needsAi: string[] = [];

  const rows = quiz.items.map(({ question }) => {
    maxScore += question.points;
    const answer = (answers[question.id] ?? null) as StudentAnswer | null;
    const graded = gradeAnswer(question, answer);
    if (graded.needsAi) needsAi.push(question.id);
    score += graded.points;

    return {
      questionId: question.id,
      answerJson: answer ?? { type: "text" as const, value: "" },
      isCorrect: graded.isCorrect,
      pointsEarned: graded.points,
      timeSpentSec: timeSpent?.[question.id] ?? null,
    };
  });

  const attempt = await db.quizAttempt.create({
    data: {
      quizId,
      studentId: user.id,
      attemptNo: doneAttempts + 1,
      submittedAt: new Date(),
      score,
      maxScore,
      answers: { create: rows },
    },
    select: { id: true },
  });

  // Qisqa javoblar aniq mos kelmadi — AI mazmunan baholaydi.
  // Javob darhol qaytariladi, AI keyin ball qo'shadi.
  // Mavzu bahosi AI tugagandan KEYIN hisoblanadi — aks holda AI to'g'ri
  // deb topgan javob "xato" sifatida bahoga tushib qoladi.
  after(async () => {
    if (needsAi.length > 0) await gradeShortAnswers(attempt.id);
    await applyQuizEvidence(attempt.id);
    await grantRewards(user.id, { type: "quiz", id: attempt.id });
  });

  return NextResponse.json({
    attemptId: attempt.id,
    score,
    maxScore,
    percent: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    aiPending: needsAi.length > 0,
  });
}
