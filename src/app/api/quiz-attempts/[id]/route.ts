import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getApiUser } from "@/lib/guards";
import type { QuestionOption } from "@/lib/quiz";

export const runtime = "nodejs";

/**
 * Urinish natijasi — savol-savol tahlil.
 *
 * To'g'ri javoblar FAQAT quiz.showAnswersAt ruxsat berganda qaytariladi.
 * Aks holda o'quvchi javoblarni ko'rib, keyingi urinishda ko'chirib yozadi.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Avtorizatsiya kerak." }, { status: 401 });
  }

  const { id } = await params;

  const attempt = await db.quizAttempt.findUnique({
    where: { id },
    select: {
      id: true,
      studentId: true,
      score: true,
      maxScore: true,
      submittedAt: true,
      quiz: { select: { showAnswersAt: true, dueAt: true } },
      answers: {
        select: {
          questionId: true,
          answerJson: true,
          isCorrect: true,
          pointsEarned: true,
          aiFeedback: true,
          question: {
            select: {
              type: true,
              prompt: true,
              codeSnippet: true,
              options: true,
              correctText: true,
              explanation: true,
              points: true,
            },
          },
        },
      },
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: "Topilmadi." }, { status: 404 });
  }
  if (user.role !== "TEACHER" && attempt.studentId !== user.id) {
    return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 403 });
  }

  // Javoblarni ko'rsatsak bo'ladimi?
  const reveal = attempt.quiz.showAnswersAt;
  const dueOver = attempt.quiz.dueAt ? new Date() > attempt.quiz.dueAt : true;
  const showAnswers =
    user.role === "TEACHER" ||
    reveal === "IMMEDIATELY" ||
    reveal === "AFTER_SUBMIT" ||
    (reveal === "AFTER_DUE" && dueOver);

  return NextResponse.json({
    score: attempt.score,
    maxScore: attempt.maxScore,
    showAnswers,
    answers: attempt.answers.map((a) => {
      const opts = (a.question.options as QuestionOption[] | null) ?? null;
      return {
        questionId: a.questionId,
        prompt: a.question.prompt,
        codeSnippet: a.question.codeSnippet,
        type: a.question.type,
        isCorrect: a.isCorrect,
        pointsEarned: a.pointsEarned,
        maxPoints: a.question.points,
        aiFeedback: a.aiFeedback,
        yourAnswer: a.answerJson,
        // Faqat ruxsat berilganda
        options: showAnswers ? opts : opts?.map((o) => ({ ...o, isCorrect: false })) ?? null,
        correctText: showAnswers ? a.question.correctText : null,
        explanation: showAnswers ? a.question.explanation : null,
      };
    }),
  });
}
