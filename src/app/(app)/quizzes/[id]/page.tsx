import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { db } from "@/lib/db";
import { requireStudent } from "@/lib/guards";
import { canStudentAccessQuiz, type QuestionOption } from "@/lib/quiz";
import { Card, CardContent } from "@/components/ui/card";
import { QuizRunner, type RunnerQuestion } from "./QuizRunner";

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

  const used = await db.quizAttempt.count({
    where: { quizId: id, studentId: user.id, submittedAt: { not: null } },
  });

  if (used >= quiz.maxAttempts) {
    return (
      <div className="space-y-4">
        <Link
          href="/quizzes"
          className="inline-flex h-11 items-center gap-1.5 text-sm text-muted-foreground"
        >
          <ArrowLeft size={16} aria-hidden /> Testlar
        </Link>
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Bu testni {quiz.maxAttempts} marta ishlab bo'lgansiz. Yangi urinish
            uchun o'qituvchiga murojaat qiling.
          </CardContent>
        </Card>
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
      <Link
        href="/quizzes"
        className="inline-flex h-11 items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft size={16} aria-hidden /> Testlar
      </Link>

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
