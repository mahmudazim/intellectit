import Link from "next/link";
import { CircleCheck, Clock, Target } from "lucide-react";

import { requireStudent } from "@/lib/guards";
import { getStudentAssignments } from "@/lib/assignments";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Vazifalar" };

function formatDue(due: Date | null) {
  if (!due) return null;
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  }).format(due);
}

export default async function StudentAssignmentsPage() {
  const user = await requireStudent();
  const assignments = await getStudentAssignments(user.id);

  const now = new Date();
  const done = assignments.filter(
    (a) => a.submission && a.submission.status === "GRADED"
  );
  const pending = assignments.filter(
    (a) => !a.submission || a.submission.status !== "GRADED"
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          Vazifalar
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pending.length} ta bajarilmagan, {done.length} ta bajarilgan
        </p>
      </div>

      {assignments.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Hozircha vazifa yo'q. O'qituvchi vazifa berganda shu yerda paydo
            bo'ladi.
          </CardContent>
        </Card>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Bajarilmagan
          </h2>
          {pending.map((a) => {
            const overdue = a.dueAt ? now > a.dueAt : false;
            return (
              <Link key={a.id} href={`/assignments/${a.id}`} className="block">
                <Card className="transition-colors hover:border-primary/40">
                  <CardContent className="space-y-2 p-4 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium leading-snug">{a.title}</p>
                      <Badge variant="neutral">{a.difficulty}-daraja</Badge>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {a.topic.name}
                      {a._count.testCases > 0
                        ? ` · ${a._count.testCases} test`
                        : ""}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      {a.dueAt && (
                        <Badge variant={overdue ? "danger" : "warning"}>
                          <Clock size={12} aria-hidden />
                          {overdue ? "Muddat o'tdi" : formatDue(a.dueAt)}
                        </Badge>
                      )}
                      {a.reason && (
                        <Badge variant="default">
                          <Target size={12} aria-hidden />
                          {a.reason}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Bajarilgan
          </h2>
          {done.map((a) => (
            <Link key={a.id} href={`/assignments/${a.id}`} className="block">
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-3 p-4 pt-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                    <CircleCheck size={17} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-snug">
                      {a.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {a.submission?.testsTotal
                        ? `${a.submission.testsPassed}/${a.submission.testsTotal} test`
                        : a.topic.name}
                    </p>
                  </div>
                  <span className="shrink-0 text-lg font-bold">
                    {a.submission?.finalScore ?? 0}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
