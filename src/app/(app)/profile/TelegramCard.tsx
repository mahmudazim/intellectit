"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, ExternalLink, Send, Unlink } from "lucide-react";

import {
  createLinkTokenAction,
  unlinkTelegramAction,
  updateNotificationPrefAction,
} from "./telegram-actions";
import type { ActionState } from "@/lib/actions-util";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type NotificationPrefs = {
  telegramOn: boolean;
  newAssignment: boolean;
  gradeReady: boolean;
  dueReminder: boolean;
  streakWarning: boolean;
};

function LinkButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="block" disabled={pending}>
      {pending ? (
        "Havola tayyorlanmoqda..."
      ) : (
        <>
          <Send aria-hidden /> Telegram'ni ulash
        </>
      )}
    </Button>
  );
}

export function TelegramCard({
  linked,
  telegramUser,
  prefs,
}: {
  linked: boolean;
  telegramUser: string | null;
  prefs: NotificationPrefs;
}) {
  const [state, formAction] = useActionState<ActionState<{ url: string }>, FormData>(
    createLinkTokenAction,
    {}
  );

  const toggles: { name: keyof NotificationPrefs; label: string }[] = [
    { name: "newAssignment", label: "Yangi vazifa berilganda" },
    { name: "gradeReady", label: "Javob baholanganda" },
    { name: "dueReminder", label: "Muddat yaqinlashganda" },
    { name: "streakWarning", label: "Streak xavf ostida bo'lganda" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Telegram</CardTitle>
          {linked && (
            <Badge variant="success">
              <Check size={11} aria-hidden /> Ulangan
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!linked ? (
          <>
            <p className="text-sm text-muted-foreground">
              Telegram'ni ulasangiz yangi vazifa, baho va muddat haqida xabar
              keladi. Platformaga har safar kirish shart bo'lmaydi.
            </p>

            {state.ok && state.data ? (
              <div className="space-y-2">
                <a
                  href={state.data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ size: "block" })}
                >
                  <ExternalLink aria-hidden /> Telegram'da ochish
                </a>
                <p className="text-xs text-muted-foreground">
                  Havola 15 daqiqa amal qiladi. Telegram ochilgach{" "}
                  <strong>Start</strong> tugmasini bosing.
                </p>
              </div>
            ) : (
              <form action={formAction}>
                <LinkButton />
              </form>
            )}

            {state.error && (
              <p
                role="alert"
                className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {state.error}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {telegramUser ? `@${telegramUser}` : "Telegram akkaunti"} ulangan.
            </p>

            <form action={updateNotificationPrefAction} className="space-y-2">
              <input type="hidden" name="telegramOn" value="on" />
              {toggles.map((t) => (
                <label
                  key={t.name}
                  className="flex h-11 items-center gap-3 text-sm"
                >
                  <input
                    type="checkbox"
                    name={t.name}
                    defaultChecked={prefs[t.name]}
                    className="size-4"
                  />
                  {t.label}
                </label>
              ))}
              <Button type="submit" variant="outline" size="block">
                Sozlamalarni saqlash
              </Button>
            </form>

            <form action={unlinkTelegramAction}>
              <Button type="submit" variant="ghost" size="block">
                <Unlink aria-hidden /> Uzish
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
