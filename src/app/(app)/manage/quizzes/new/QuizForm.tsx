"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { createQuizAction } from "../actions";
import type { ActionState } from "@/lib/actions-util";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Question = {
  id: string;
  prompt: string;
  typeLabel: string;
  topicName: string;
  difficulty: number;
};
type Group = { id: string; name: string };
type Student = { id: string; fullName: string };

function SaveButtons({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col gap-2 md:flex-row-reverse">
      <Button type="submit" name="publish" value="1" size="block" disabled={pending || count === 0}>
        {pending ? "Saqlanmoqda..." : `Saqlash va berish (${count} savol)`}
      </Button>
      <Button type="submit" name="publish" value="0" variant="outline" size="block" disabled={pending}>
        Qoralama
      </Button>
    </div>
  );
}

export function QuizForm({
  questions,
  groups,
  students,
}: {
  questions: Question[];
  groups: Group[];
  students: Student[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionState<{ id: string }>, FormData>(
    async (prev, fd) => {
      const r = await createQuizAction(prev, fd);
      if (r.ok) router.push("/manage/quizzes");
      return r;
    },
    {}
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [filter, setFilter] = useState("");

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const visible = filter
    ? questions.filter(
        (q) =>
          q.prompt.toLowerCase().includes(filter.toLowerCase()) ||
          q.topicName.toLowerCase().includes(filter.toLowerCase())
      )
    : questions;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="questionIds" value={JSON.stringify(selected)} />
      <input type="hidden" name="groupIds" value={JSON.stringify(groupIds)} />
      <input type="hidden" name="studentIds" value={JSON.stringify(studentIds)} />

      <Card>
        <CardContent className="space-y-4 p-4 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Test nomi</Label>
            <Input id="title" name="title" placeholder="Sikllar bo'yicha nazorat" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Izoh (ixtiyoriy)</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="timeLimitMin">Vaqt (daqiqa)</Label>
              <Input
                id="timeLimitMin"
                name="timeLimitMin"
                type="number"
                inputMode="numeric"
                min={1}
                max={180}
                placeholder="cheksiz"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxAttempts">Urinishlar</Label>
              <select
                id="maxAttempts"
                name="maxAttempts"
                defaultValue="1"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 md:h-9"
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="showAnswersAt">Javoblarni ko'rsatish</Label>
              <select
                id="showAnswersAt"
                name="showAnswersAt"
                defaultValue="AFTER_SUBMIT"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 md:h-9"
              >
                <option value="AFTER_SUBMIT">Topshirgandan keyin</option>
                <option value="AFTER_DUE">Muddat tugagach</option>
                <option value="NEVER">Ko'rsatilmasin</option>
              </select>
            </div>
          </div>

          <label className="flex h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="shuffle" defaultChecked className="size-4" />
            Savollar va variantlarni aralashtirish (ko'chirishga qarshi)
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="dueAt">Muddat (ixtiyoriy)</Label>
            <Input id="dueAt" name="dueAt" type="datetime-local" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Savollar ({selected.length} tanlangan)</Label>
            {questions.length > 6 && (
              <Input
                placeholder="Qidirish..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full md:w-56"
              />
            )}
          </div>

          {questions.length === 0 && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Tasdiqlangan savol yo'q. Avval savollar bankini to'ldiring.
            </p>
          )}

          <div className="space-y-2">
            {visible.map((q) => {
              const on = selected.includes(q.id);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSelected((l) => toggle(l, q.id))}
                  aria-pressed={on}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors",
                    on ? "border-primary bg-primary/10" : "border-border"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    readOnly
                    tabIndex={-1}
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug">
                      {q.prompt}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="neutral">{q.typeLabel}</Badge>
                      <Badge variant="neutral">{q.topicName}</Badge>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4 pt-4">
          <Label>Kimga berish</Label>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <label
                key={g.id}
                className={cn(
                  "flex h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm",
                  groupIds.includes(g.id) ? "border-primary bg-primary/10 text-primary" : "border-border"
                )}
              >
                <input
                  type="checkbox"
                  className="size-4"
                  checked={groupIds.includes(g.id)}
                  onChange={() => setGroupIds((l) => toggle(l, g.id))}
                />
                {g.name}
              </label>
            ))}
          </div>

          {students.length > 0 && (
            <details className="rounded-md border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Alohida o'quvchilar ({studentIds.length})
              </summary>
              <div className="mt-3 flex flex-wrap gap-2">
                {students.map((s) => (
                  <label
                    key={s.id}
                    className={cn(
                      "flex h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm",
                      studentIds.includes(s.id) ? "border-primary bg-primary/10 text-primary" : "border-border"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={studentIds.includes(s.id)}
                      onChange={() => setStudentIds((l) => toggle(l, s.id))}
                    />
                    {s.fullName}
                  </label>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      {state.error && (
        <div role="alert" className="flex gap-2 rounded-md bg-danger/10 px-3 py-3 text-sm text-danger">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <SaveButtons count={selected.length} />
    </form>
  );
}
