import Link from "next/link";
import { CircleCheck, Clock, ListChecks } from "lucide-react";

import { requireStudent } from "@/lib/guards";
import { getStudentQuizzes } from "@/lib/quiz";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Testlar" };

export default async function StudentQuizzesPage() {
  const user = await requireStudent();
  const quizzes = await getStudentQuizzes(user.id);

  const todo = quizzes.filter((q) => q.canAttempt);
  const done = quizzes.filter((q) => !q.canAttempt);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">Testlar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {todo.length} ta ishlanmagan, {done.length} ta yakunlangan
        </p>
      </div>

      {quizzes.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Hozircha test yo'q.
          </CardContent>
        </Card>
      )}

      {todo.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Ishlanmagan
          </h2>
          {todo.map((q) => (
            <Link key={q.id} href={`/quizzes/${q.id}`} className="block">
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="space-y-2 p-4 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium leading-snug">{q.title}</p>
                    <Badge variant="neutral">{q._count.items} savol</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {q.timeLimitMin && (
                      <Badge variant="warning">
                        <Clock size={12} aria-hidden /> {q.timeLimitMin} daqiqa
                      </Badge>
                    )}
                    {q.isDiagnostic && (
                      <Badge variant="default">Bilim tekshiruvi</Badge>
                    )}
                    {q.attempts.length > 0 && (
                      <Badge variant="neutral">
                        {q.attempts.length}/{q.maxAttempts} urinish
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Yakunlangan
          </h2>
          {done.map((q) => {
            const best = q.bestScore ?? 0;
            const max = q.attempts[0]?.maxScore ?? 0;
            const percent = max > 0 ? Math.round((best / max) * 100) : 0;
            return (
              <Card key={q.id}>
                <CardContent className="flex items-center gap-3 p-4 pt-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                    <CircleCheck size={17} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-snug">{q.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {best} / {max} ball
                    </p>
                  </div>
                  <span className="shrink-0 text-lg font-bold">{percent}%</span>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
