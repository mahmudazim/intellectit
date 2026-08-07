"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";

import { createGroupAction } from "./actions";
import type { ActionState } from "@/lib/actions-util";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="block" disabled={pending}>
      {pending ? "Saqlanmoqda..." : "Guruh yaratish"}
    </Button>
  );
}

export function GroupForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    createGroupAction,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.ok]);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="block" className="md:w-auto">
        <Plus aria-hidden /> Yangi guruh
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Guruh nomi</Label>
            <Input
              id="name"
              name="name"
              placeholder="masalan: 9-A sinf (IT)"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kind">Turi</Label>
            <select
              id="kind"
              name="kind"
              defaultValue="SCHOOL_CLASS"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 md:h-9"
            >
              <option value="SCHOOL_CLASS">Maktab sinfi</option>
              <option value="CLUB">To'garak</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Izoh (ixtiyoriy)</Label>
            <Input id="note" name="note" placeholder="Dushanba, Chorshanba 15:00" />
          </div>

          {state.error && (
            <p
              role="alert"
              className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {state.error}
            </p>
          )}

          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <SubmitButton />
            <Button
              type="button"
              variant="ghost"
              size="block"
              onClick={() => setOpen(false)}
            >
              Bekor qilish
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
