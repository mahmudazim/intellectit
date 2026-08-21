import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import { buildAttemptReview } from "@/lib/quiz";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewList } from "@/app/(app)/quizzes/[id]/ReviewList";

export default async function QuizResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();
  const { id } = await params;

  const quiz = await db.quiz.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!quiz) notFound();

  // Har bir o'quvchining eng oxirgi (tugallangan) urinishi
  const attempts = await db.quizAttempt.findMany({
    where: { quizId: id, submittedAt: { not: null } },
    orderBy: [{ studentId: "asc" }, { startedAt: "desc" }],
    select: {
      id: true,
      studentId: true,
      attemptNo: true,
      score: true,
      maxScore: true,
      submittedAt: true,
      student: { select: { fullName: true } },
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

  const latest = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) {
    if (!latest.has(a.studentId)) latest.set(a.studentId, a);
  }
  const rows = [...latest.values()].sort((a, b) =>
    a.student.fullName.localeCompare(b.student.fullName)
  );

  const avg =
    rows.length > 0
      ? Math.round(
          (rows.reduce(
            (sum, r) => sum + (r.maxScore ? (r.score ?? 0) / r.maxScore : 0),
            0
          ) /
            rows.length) *
            100
        )
      : 0;

  return (
    <div className="space-y-4">
      <Link
        href="/manage/quizzes"
        className="inline-flex h-11 items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft size={16} aria-hidden /> Testlar
      </Link>

      <div>
        <h1 className="text-lg font-bold leading-snug tracking-tight md:text-2xl">
          {quiz.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} javob · o'rtacha {avg}%
        </p>
      </div>

      {rows.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Hali hech kim ishlamagan.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {rows.map((r) => {
          const percent =
            r.maxScore && r.maxScore > 0
              ? Math.round(((r.score ?? 0) / r.maxScore) * 100)
              : 0;
          const review = buildAttemptReview(r, true);

          return (
            <Card key={r.id}>
              <CardContent className="space-y-2 p-4 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{r.student.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {r.attemptNo}-urinish · {r.score ?? 0}/{r.maxScore ?? 0} ball
                    </p>
                  </div>
                  <Badge variant={percent >= 60 ? "success" : "warning"}>
                    {percent}%
                  </Badge>
                </div>

                <details className="rounded-md border border-border">
                  <summary className="cursor-pointer p-2.5 text-sm font-medium">
                    Javoblarni ko'rish
                  </summary>
                  <div className="border-t border-border p-2.5">
                    <ReviewList review={review.answers} />
                  </div>
                </details>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
