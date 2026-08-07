"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Sparkles } from "lucide-react";

import { generateQuestionsAction } from "./ai-actions";
import type { ActionState } from "@/lib/actions-util";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/input";

type Topic = { id: string; name: string; moduleName: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="block" disabled={pending} className="md:w-auto">
      {pending ? (
        "AI savol yozmoqda... (~20s)"
      ) : (
        <>
          <Sparkles aria-hidden /> AI bilan savol yaratish
        </>
      )}
    </Button>
  );
}

export function GenerateQuestions({ topics }: { topics: Topic[] }) {
  const [state, formAction] = useActionState<
    ActionState<{ created: number; rejected: number }>,
    FormData
  >(generateQuestionsAction, {});

  const grouped = topics.reduce<Record<string, Topic[]>>((acc, t) => {
    (acc[t.moduleName] ??= []).push(t);
    return acc;
  }, {});

  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <form action={formAction} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="gen-topic">Mavzu</Label>
              <select
                id="gen-topic"
                name="topicId"
                required
                defaultValue=""
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 md:h-9"
              >
                <option value="" disabled>
                  Tanlang...
                </option>
                {Object.entries(grouped).map(([mod, list]) => (
                  <optgroup key={mod} label={mod}>
                    {list.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gen-count">Soni</Label>
              <select
                id="gen-count"
                name="count"
                defaultValue="5"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 md:h-9"
              >
                {[3, 5, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <Submit />
          </div>

          <p className="text-xs text-muted-foreground">
            Kod natijasi savollari sandbox'da avtomatik tekshiriladi. Yaratilgan
            savollar siz tasdiqlamaguncha testga qo'shilmaydi.
          </p>

          {state.error && (
            <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}
          {state.ok && state.data && (
            <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
              {state.data.created} ta savol yaratildi
              {state.data.rejected > 0
                ? ` (${state.data.rejected} tasi tekshiruvdan o'tmadi va tashlab yuborildi)`
                : ""}
              . Tasdiqlash navbatida ko'ring.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
