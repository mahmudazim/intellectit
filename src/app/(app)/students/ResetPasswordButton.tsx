"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, KeyRound } from "lucide-react";

import { resetPasswordAction, type CreatedStudent } from "./actions";
import type { ActionState } from "@/lib/actions-util";
import { Button } from "@/components/ui/button";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="icon"
      disabled={pending}
      aria-label="Parolni yangilash"
      title="Parolni yangilash"
    >
      <KeyRound aria-hidden />
    </Button>
  );
}

export function ResetPasswordButton({ studentId }: { studentId: string }) {
  const [state, formAction] = useActionState<ActionState<CreatedStudent>, FormData>(
    resetPasswordAction,
    {}
  );
  const [copied, setCopied] = useState(false);

  if (state.ok && state.data) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1">
        <code className="text-sm font-semibold">{state.data.password}</code>
        <button
          type="button"
          className="flex size-8 items-center justify-center text-muted-foreground"
          aria-label="Nusxalash"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(state.data!.password);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard ruxsati yo'q */
            }
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={studentId} />
      <Submit />
    </form>
  );
}
