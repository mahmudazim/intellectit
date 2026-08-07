"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { changePasswordAction, type ChangePwState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="block" disabled={pending}>
      {pending ? "Saqlanmoqda..." : "Parolni saqlash"}
    </Button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ChangePwState, FormData>(
    changePasswordAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">Yangi parol</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">
          Kamida 8 ta belgi. Eslab qoladiganini tanlang.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm">Parolni takrorlang</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          enterKeyHint="go"
          required
        />
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
