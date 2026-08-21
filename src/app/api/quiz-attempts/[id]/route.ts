import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getApiUser } from "@/lib/guards";
import { buildAttemptReview } from "@/lib/quiz";

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

  return NextResponse.json(buildAttemptReview(attempt, user.role === "TEACHER"));
}
