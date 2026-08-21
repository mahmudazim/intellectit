import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, CircleX } from "lucide-react";

import { db } from "@/lib/db";
import { requireStudent } from "@/lib/guards";
import { buildAttemptReview, canStudentAccessQuiz, type QuestionOption } from "@/lib/quiz";
import { Card, CardContent } from "@/components/ui/card";
import { QuizRunner, type RunnerQuestion } from "./QuizRunner";
import { ReviewList } from "./ReviewList";
import { cn } from "@/lib/utils";

/** Tanlovlarni aralashtirish (Fisher-Yates) — o'quvchilar bir-biridan ko'chirmasin. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function TakeQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStudent();
  const { id } = await params;

  if (!(await canStudentAccessQuiz(user.id, id))) notFound();

  const quiz = await db.quiz.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      timeLimitMin: true,
      maxAttempts: true,
      shuffle: true,
      status: true,
      items: {
        orderBy: { order: "asc" },
        select: {
          question: {
            select: {
              id: true,
              type: true,
              prompt: true,
              codeSnippet: true,
              points: true,
              options: true,
              // correctText va explanation ATAYLAB olinmaydi —
              // o'quvchiga javob ketmasligi kerak
            },
          },
        },
      },
    },
  });
  if (!quiz) notFound();

  const usedCount = await db.quizAttempt.count({
    where: { quizId: id, studentId: user.id, submittedAt: { not: null } },
  });

  const backLink = (
    <Link
      href="/quizzes"
      className="inline-flex h-11 items-center gap-1.5 text-sm text-muted-foreground"
    >
      <ArrowLeft size={16} aria-hidden /> Testlar
    </Link>
  );

  // Arxivlangan test yoki urinishlar tugagan bo'lsa — faqat oxirgi
  // natijani ko'rsatamiz, qayta ishlashga ruxsat berilmaydi.
  if (quiz.status === "ARCHIVED" || usedCount >= quiz.maxAttempts) {
    const attempt = await db.quizAttempt.findFirst({
      where: { quizId: id, studentId: user.id, submittedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      select: {
        score: true,
        maxScore: true,
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

    return (
      <div className="space-y-4">
        {backLink}

        <div>
          <h1 className="text-lg font-bold leading-snug tracking-tight md:text-2xl">
            {quiz.title}
          </h1>
        </div>

        {!attempt ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Bu testni ishlamagansiz — u endi ochiq emas.
            </CardContent>
          </Card>
        ) : (
          <QuizResultSummary
            score={attempt.score ?? 0}
            maxScore={attempt.maxScore ?? 0}
            review={buildAttemptReview(attempt, false)}
          />
        )}
      </div>
    );
  }

  // isCorrect maydonini olib tashlaymiz — javob o'quvchiga ketmasin
  const questions: RunnerQuestion[] = quiz.items.map(({ question }) => {
    const raw = (question.options as QuestionOption[] | null) ?? null;
    const safe = raw ? raw.map((o) => ({ id: o.id, text: o.text })) : null;
    return {
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      codeSnippet: question.codeSnippet,
      points: question.points,
      options: safe && quiz.shuffle ? shuffle(safe) : safe,
    };
  });

  const ordered = quiz.shuffle ? shuffle(questions) : questions;

  return (
    <div className="space-y-4">
      {backLink}

      <div>
        <h1 className="text-lg font-bold leading-snug tracking-tight md:text-2xl">
          {quiz.title}
        </h1>
        {quiz.description && (
          <p className="mt-1 text-sm text-muted-foreground">{quiz.description}</p>
        )}
      </div>

      <QuizRunner
        quizId={quiz.id}
        title={quiz.title}
        questions={ordered}
        timeLimitMin={quiz.timeLimitMin}
      />
    </div>
  );
}

function QuizResultSummary({
  score,
  maxScore,
  review,
}: {
  score: number;
  maxScore: number;
  review: ReturnType<typeof buildAttemptReview>;
}) {
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const good = percent >= 60;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-5 text-center">
          <div
            className={cn(
              "mx-auto flex size-14 items-center justify-center rounded-2xl",
              good ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
            )}
          >
            {good ? (
              <CircleCheck size={28} aria-hidden />
            ) : (
              <CircleX size={28} aria-hidden />
            )}
          </div>

          <div>
            <p className="text-3xl font-bold">{percent}%</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {score} / {maxScore} ball
            </p>
          </div>
        </CardContent>
      </Card>

      <ReviewList review={review.answers} heading="Javoblaringiz tahlili" />
    </div>
  );
}
