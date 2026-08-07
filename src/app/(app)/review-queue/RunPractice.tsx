"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Wand } from "lucide-react";

import { runPracticeAssignmentAction } from "./actions";
import type { ActionState } from "@/lib/actions-util";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Data = { assigned: number; students: number; generated: number };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="block" disabled={pending} className="md:w-auto">
      {pending ? (
        "Tahlil qilinmoqda..."
      ) : (
        <>
          <Wand aria-hidden /> Hozir taqsimlash
        </>
      )}
    </Button>
  );
}

export function RunPractice() {
  const [state, formAction] = useActionState<ActionState<Data>, FormData>(
    runPracticeAssignmentAction,
    {}
  );

  return (
    <Card>
      <CardContent className="space-y-3 p-4 pt-4">
        <div>
          <p className="font-medium">Zaif mavzular bo'yicha mashq berish</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Har kecha avtomatik ishlaydi. Kutmasdan hozir ishga tushirishingiz
            ham mumkin.
          </p>
        </div>

        <form action={formAction}>
          <Submit />
        </form>

        {state.error && (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.ok && state.data && (
          <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
            {state.data.assigned} ta mashq {state.data.students} o'quvchiga
            berildi
            {state.data.generated > 0
              ? `, ${state.data.generated} ta yangi vazifa yaratildi (pastda tasdiqlang)`
              : ""}
            .
          </p>
        )}
      </CardContent>
    </Card>
  );
}
