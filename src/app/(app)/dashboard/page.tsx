import Link from "next/link";
import { ClipboardList, Clock, Flame, Sparkles, Zap } from "lucide-react";

import { requireStudent } from "@/lib/guards";
import { db } from "@/lib/db";
import { getStudentAssignments } from "@/lib/assignments";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Bosh sahifa" };

export default async function StudentDashboard() {
  const user = await requireStudent();

  const [xpAgg, streak, assignments] = await Promise.all([
    db.xpEvent.aggregate({
      where: { userId: user.id },
      _sum: { amount: true },
    }),
    db.streak.findUnique({ where: { userId: user.id } }),
    getStudentAssignments(user.id),
  ]);

  const totalXp = xpAgg._sum.amount ?? 0;
  const level = Math.floor(Math.sqrt(totalXp / 100)) + 1;

  const pending = assignments.filter(
    (a) => !a.submission || a.submission.status !== "GRADED"
  );
  const now = new Date();

  const stats = [
    { label: "XP", value: totalXp, icon: Zap },
    { label: "Daraja", value: level, icon: Sparkles },
    { label: "Streak", value: `${streak?.current ?? 0} kun`, icon: Flame },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          Salom, {user.fullName.split(" ")[0]}!
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pending.length > 0
            ? `${pending.length} ta vazifa kutmoqda.`
            : "Barcha vazifalar bajarilgan. Zo'r!"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex flex-col items-center gap-1 p-3 pt-3 md:p-4 md:pt-4">
              <Icon size={18} className="text-primary" aria-hidden />
              <span className="text-lg font-bold leading-none md:text-xl">
                {value}
              </span>
              <span className="text-[11px] text-muted-foreground">{label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Bajarilmagan vazifalar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <ClipboardList
                size={28}
                className="text-muted-foreground"
                aria-hidden
              />
              <p className="text-sm text-muted-foreground">
                Hozircha vazifa yo'q.
              </p>
            </div>
          ) : (
            <>
              {pending.slice(0, 4).map((a) => {
                const overdue = a.dueAt ? now > a.dueAt : false;
                return (
                  <Link
                    key={a.id}
                    href={`/assignments/${a.id}`}
                    className="flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:border-primary/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium leading-snug">
                        {a.title}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {a.topic.name}
                      </p>
                    </div>
                    {a.dueAt && (
                      <Badge variant={overdue ? "danger" : "warning"}>
                        <Clock size={12} aria-hidden />
                        {overdue ? "Kechikdi" : "Muddat"}
                      </Badge>
                    )}
                  </Link>
                );
              })}

              {pending.length > 4 && (
                <Link
                  href="/assignments"
                  className={buttonVariants({
                    variant: "outline",
                    size: "block",
                  })}
                >
                  Barchasini ko'rish ({pending.length})
                </Link>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
