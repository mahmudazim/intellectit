"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, Plus, UserPlus } from "lucide-react";

import { createStudentAction, type CreatedStudent } from "./actions";
import type { ActionState } from "@/lib/actions-util";
import { suggestUsername } from "@/lib/actions-util";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Group = { id: string; name: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="block" disabled={pending}>
      {pending ? "Qo'shilmoqda..." : "O'quvchi qo'shish"}
    </Button>
  );
}

/** Yaratilgandan keyin parolni ko'rsatuvchi kartochka — parol boshqa ko'rinmaydi. */
function CredentialsCard({
  student,
  onDone,
}: {
  student: CreatedStudent;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = `IntellectIT\nIsm: ${student.fullName}\nLogin: ${student.username}\nParol: ${student.password}`;

  return (
    <Card className="border-success/40 bg-success/5">
      <CardContent className="space-y-3 p-4 pt-4">
        <p className="text-sm font-medium text-success">
          {student.fullName} qo'shildi
        </p>

        <div className="rounded-md border border-border bg-background p-3 font-mono text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Login</span>
            <span className="font-semibold">{student.username}</span>
          </div>
          <div className="mt-1 flex justify-between gap-2">
            <span className="text-muted-foreground">Parol</span>
            <span className="font-semibold">{student.password}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Bu parol boshqa ko'rinmaydi — o'quvchiga hozir bering. U birinchi
          kirishda o'z parolini o'rnatadi.
        </p>

        <div className="flex flex-col gap-2 md:flex-row">
          <Button
            type="button"
            variant="outline"
            size="block"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* clipboard ruxsati yo'q — foydalanuvchi qo'lda ko'chiradi */
              }
            }}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Nusxalandi" : "Nusxalash"}
          </Button>
          <Button type="button" size="block" onClick={onDone}>
            <Plus aria-hidden /> Yana qo'shish
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function StudentForm({
  groups,
  defaultGroupId,
}: {
  groups: Group[];
  defaultGroupId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState<CreatedStudent>, FormData>(
    createStudentAction,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [touchedUsername, setTouchedUsername] = useState(false);
  // Parol kartochkasi yopilganini belgilaydi (state.ok ni o'zgartirib bo'lmaydi)
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setFullName("");
      setUsername("");
      setTouchedUsername(false);
    }
  }, [state.ok]);

  const created = state.ok ? state.data : undefined;
  if (created && dismissedFor !== created.username) {
    return (
      <CredentialsCard
        student={created}
        onDone={() => {
          setDismissedFor(created.username);
          setOpen(true);
        }}
      />
    );
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="block" className="md:w-auto">
        <UserPlus aria-hidden /> O'quvchi qo'shish
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">To'liq ism</Label>
            <Input
              id="fullName"
              name="fullName"
              placeholder="Aziz Karimov"
              autoFocus
              autoComplete="off"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (!touchedUsername) {
                  setUsername(suggestUsername(e.target.value));
                }
              }}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Login</Label>
            <Input
              id="username"
              name="username"
              placeholder="aziz2009"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              value={username}
              onChange={(e) => {
                setTouchedUsername(true);
                setUsername(e.target.value.toLowerCase());
              }}
              required
            />
            <p className="text-xs text-muted-foreground">
              Faqat lotin harflari va raqamlar. Parol avtomatik yaratiladi.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="groupId">Guruh</Label>
            <select
              id="groupId"
              name="groupId"
              defaultValue={defaultGroupId ?? ""}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 md:h-9"
            >
              <option value="">Guruhsiz</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
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
