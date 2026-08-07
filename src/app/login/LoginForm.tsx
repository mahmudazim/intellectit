"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";

import { loginAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="block" disabled={pending}>
      {pending ? (
        "Kirilmoqda..."
      ) : (
        <>
          <LogIn aria-hidden /> Kirish
        </>
      )}
    </Button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(
    loginAction,
    {}
  );
  const [showPw, setShowPw] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div className="space-y-1.5">
        <Label htmlFor="username">Login</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="next"
          placeholder="masalan: aziz2009"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Parol</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            enterKeyHint="go"
            placeholder="••••••••"
            className="pr-12"
            required
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground md:h-9 md:w-9"
            aria-label={showPw ? "Parolni yashirish" : "Parolni ko'rsatish"}
          >
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
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
