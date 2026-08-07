import { Check, ClipboardList, Inbox, X } from "lucide-react";

import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import { QUESTION_TYPE_LABEL, type QuestionOption } from "@/lib/quiz";
import { getPracticeSuggestions } from "@/lib/mastery/recommend";
import {
  approveQuestionAction,
  rejectQuestionAction,
} from "../manage/quizzes/ai-actions";
import { approveAssignmentAction, rejectAssignmentAction } from "./actions";
import { RunPractice } from "./RunPractice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Tasdiqlash navbati" };

export default async function ReviewQueuePage() {
  await requireTeacher();

  const [assignments, questions, suggestions] = await Promise.all([
    db.assignment.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        starterCode: true,
        solutionCode: true,
        source: true,
        topic: { select: { name: true } },
        testCases: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            stdin: true,
            expectedStdout: true,
            isHidden: true,
          },
        },
      },
    }),
    db.question.findMany({
      where: { isApproved: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        prompt: true,
        codeSnippet: true,
        options: true,
        correctText: true,
        explanation: true,
        difficulty: true,
        topic: { select: { name: true } },
      },
    }),
    getPracticeSuggestions(6),
  ]);

  const empty = assignments.length === 0 && questions.length === 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          Tasdiqlash navbati
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI yaratgan vazifa va savollar. Tasdiqlangandan keyin o'quvchilarga
          beriladi.
        </p>
      </div>

      <RunPractice />

      {/* Kim nimadan qiynalmoqda */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Kimga mashq kerak</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.map((s) => (
              <div
                key={s.studentId}
                className="rounded-md border border-border p-3"
              >
                <p className="text-sm font-medium">{s.studentName}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {s.weak.map((w) => (
                    <Badge key={w.topicId} variant="danger">
                      {w.name} {Math.round(w.score * 100)}%
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {empty && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <Inbox size={28} className="text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Navbat bo'sh — hammasi ko'rib chiqilgan.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ---- AI yaratgan vazifalar ---- */}
      {assignments.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ClipboardList size={15} aria-hidden />
            Vazifalar ({assignments.length})
          </h2>

          {assignments.map((a) => (
            <Card key={a.id}>
              <CardContent className="space-y-3 p-4 pt-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 font-medium leading-snug">
                    {a.title}
                  </p>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge variant="default">AI</Badge>
                    <Badge variant="neutral">{a.difficulty}-daraja</Badge>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">{a.topic.name}</p>

                <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                  {a.description}
                </p>

                <details className="rounded-md border border-border">
                  <summary className="cursor-pointer p-2.5 text-sm font-medium">
                    Yechim va {a.testCases.length} ta test
                  </summary>
                  <div className="space-y-2 border-t border-border p-2.5">
                    <pre className="scroll-x rounded bg-muted p-2 font-mono text-xs">
                      {a.solutionCode}
                    </pre>
                    <p className="text-xs text-success">
                      ✓ Yechim sandbox'da barcha testlardan o'tdi
                    </p>
                    <div className="space-y-1">
                      {a.testCases.map((tc, i) => (
                        <div key={tc.id} className="text-xs">
                          <span className="text-muted-foreground">
                            Test {i + 1}
                            {tc.isHidden ? " (yashirin)" : ""}:{" "}
                          </span>
                          <code>{tc.stdin.replace(/\n/g, "⏎") || "(bo'sh)"}</code>
                          <span className="text-muted-foreground"> → </span>
                          <code>{tc.expectedStdout}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>

                <div className="flex gap-2">
                  <form action={approveAssignmentAction} className="flex-1">
                    <input type="hidden" name="id" value={a.id} />
                    <Button type="submit" size="block" variant="success">
                      <Check aria-hidden /> Tasdiqlash
                    </Button>
                  </form>
                  <form action={rejectAssignmentAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <Button
                      type="submit"
                      size="lg"
                      variant="outline"
                      aria-label="Rad etish"
                    >
                      <X aria-hidden />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* ---- AI yaratgan savollar ---- */}
      {questions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Test savollari ({questions.length})
          </h2>

          {questions.map((q) => {
            const opts = (q.options as QuestionOption[] | null) ?? null;
            return (
              <Card key={q.id}>
                <CardContent className="space-y-3 p-4 pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 font-medium leading-snug">
                      {q.prompt}
                    </p>
                    <Badge variant="neutral">
                      {QUESTION_TYPE_LABEL[q.type]}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {q.topic.name} · {q.difficulty}-daraja
                  </p>

                  {q.codeSnippet && (
                    <pre className="scroll-x rounded-md bg-muted p-3 font-mono text-sm">
                      {q.codeSnippet}
                    </pre>
                  )}

                  {opts ? (
                    <ul className="space-y-1 text-sm">
                      {opts.map((o) => (
                        <li
                          key={o.id}
                          className={o.isCorrect ? "font-medium text-success" : ""}
                        >
                          {o.isCorrect ? "✓" : "·"} {o.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm">
                      <span className="text-muted-foreground">
                        Javob (sandbox tekshirgan):{" "}
                      </span>
                      <code>{q.correctText}</code>
                    </p>
                  )}

                  {q.explanation && (
                    <p className="rounded-md bg-muted p-2.5 text-sm">
                      <span className="text-muted-foreground">Izoh: </span>
                      {q.explanation}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <form action={approveQuestionAction} className="flex-1">
                      <input type="hidden" name="id" value={q.id} />
                      <Button type="submit" size="block" variant="success">
                        <Check aria-hidden /> Tasdiqlash
                      </Button>
                    </form>
                    <form action={rejectQuestionAction}>
                      <input type="hidden" name="id" value={q.id} />
                      <Button
                        type="submit"
                        size="lg"
                        variant="outline"
                        aria-label="Rad etish"
                      >
                        <X aria-hidden />
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
