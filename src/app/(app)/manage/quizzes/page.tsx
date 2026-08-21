import Link from "next/link";
import { Inbox, Plus } from "lucide-react";

import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import { QUESTION_TYPE_LABEL, type QuestionOption } from "@/lib/quiz";
import { setQuizStatusAction } from "./actions";
import { GenerateQuestions } from "./GenerateQuestions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Testlar" };

const STATUS: Record<string, { label: string; variant: "success" | "neutral" }> = {
  PUBLISHED: { label: "Berilgan", variant: "success" },
  DRAFT: { label: "Qoralama", variant: "neutral" },
  ARCHIVED: { label: "Arxiv", variant: "neutral" },
};

export default async function ManageQuizzesPage() {
  await requireTeacher();

  const [modules, quizzes, questions, pendingCount] = await Promise.all([
    db.module.findMany({
      orderBy: { order: "asc" },
      select: { name: true, topics: { orderBy: { order: "asc" }, select: { id: true, name: true } } },
    }),
    db.quiz.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        timeLimitMin: true,
        _count: { select: { items: true, attempts: true } },
      },
    }),
    db.question.findMany({
      where: { isApproved: true },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        type: true,
        prompt: true,
        difficulty: true,
        source: true,
        options: true,
        correctText: true,
        topic: { select: { name: true } },
      },
    }),
    db.question.count({ where: { isApproved: false } }),
  ]);

  const topics = modules.flatMap((m) =>
    m.topics.map((t) => ({ ...t, moduleName: m.name }))
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Testlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {quizzes.length} ta test · {questions.length} ta tasdiqlangan savol
          </p>
        </div>
        <Link
          href="/manage/quizzes/new"
          className={buttonVariants({ className: "w-full md:w-auto" })}
        >
          <Plus aria-hidden /> Yangi test
        </Link>
      </div>

      {pendingCount > 0 && (
        <Link href="/review-queue" className="block">
          <Card className="border-warning/40 bg-warning/5 transition-colors hover:border-warning">
            <CardContent className="flex items-center gap-3 p-4 pt-4">
              <Inbox size={18} className="shrink-0 text-warning" aria-hidden />
              <p className="text-sm font-medium">
                {pendingCount} ta AI savoli tasdiqlashingizni kutmoqda →
              </p>
            </CardContent>
          </Card>
        </Link>
      )}

      <GenerateQuestions topics={topics} />

      {quizzes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Testlar</h2>
          {quizzes.map((q) => {
            const s = STATUS[q.status] ?? STATUS.DRAFT;
            return (
              <Card key={q.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4 pt-4">
                  <Link
                    href={`/manage/quizzes/${q.id}`}
                    className="min-w-0 flex-1 hover:underline"
                  >
                    <p className="font-medium leading-snug">{q.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {q._count.items} savol · {q._count.attempts} urinish
                      {q.timeLimitMin ? ` · ${q.timeLimitMin} daq` : ""}
                    </p>
                  </Link>
                  <Badge variant={s.variant}>{s.label}</Badge>
                  {q.status === "DRAFT" && (
                    <form action={setQuizStatusAction}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="status" value="PUBLISHED" />
                      <Button type="submit" size="sm">
                        Berish
                      </Button>
                    </form>
                  )}
                  {q.status === "PUBLISHED" && (
                    <form action={setQuizStatusAction}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="status" value="ARCHIVED" />
                      <Button type="submit" size="sm" variant="ghost">
                        Arxivlash
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Savollar banki
        </h2>
        {questions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Hali savol yo'q. Yuqoridagi AI generatoridan foydalaning.
            </CardContent>
          </Card>
        ) : (
          questions.map((q) => {
            const opts = (q.options as QuestionOption[] | null) ?? null;
            return (
              <Card key={q.id}>
                <CardContent className="space-y-2 p-4 pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 font-medium leading-snug">
                      {q.prompt}
                    </p>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <Badge variant="neutral">
                        {QUESTION_TYPE_LABEL[q.type]}
                      </Badge>
                      {q.source === "AI_GENERATED" && (
                        <Badge variant="default">AI</Badge>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {q.topic.name} · {q.difficulty}-daraja
                  </p>

                  {opts ? (
                    <ul className="space-y-0.5 text-sm">
                      {opts.map((o) => (
                        <li
                          key={o.id}
                          className={
                            o.isCorrect ? "text-success" : "text-muted-foreground"
                          }
                        >
                          {o.isCorrect ? "✓" : "·"} {o.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Javob: </span>
                      <code>{q.correctText}</code>
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
