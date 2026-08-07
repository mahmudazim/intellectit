"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { GraduationCap, TriangleAlert } from "lucide-react";

/**
 * Telegram Mini App autentifikatsiyasi.
 *
 * Oqim:
 *   1. Telegram `window.Telegram.WebApp.initData` beradi (imzolangan)
 *   2. Serverga yuboramiz → HMAC tekshiriladi → bir martalik token
 *   3. Token bilan sessiya ochiladi → dashboard'ga o'tamiz
 */

type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  colorScheme?: "light" | "dark";
  themeParams?: Record<string, string>;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function MiniAppAuth() {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Telegram bilan bog'lanmoqda...");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const wa = window.Telegram?.WebApp;

      if (!wa?.initData) {
        setError(
          "Bu sahifa faqat Telegram ilovasi ichida ishlaydi. Botga kirib, menyudan oching."
        );
        return;
      }

      wa.ready();
      wa.expand();

      // Telegram mavzusini (qora/oq) qo'llaymiz
      if (wa.colorScheme === "dark") {
        document.documentElement.classList.add("dark");
      }

      try {
        setStatus("Tekshirilmoqda...");
        const res = await fetch("/api/telegram/miniapp-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: wa.initData }),
        });
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setError(data?.error ?? "Kirishda xatolik.");
          return;
        }

        setStatus("Kirilmoqda...");
        await signIn("telegram", {
          token: data.token,
          redirect: true,
          callbackUrl: "/dashboard",
        });
      } catch {
        if (!cancelled) setError("Tarmoq xatosi. Qayta urinib ko'ring.");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-warning/15 text-warning">
          <TriangleAlert size={26} aria-hidden />
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-14 animate-pulse items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <GraduationCap size={26} aria-hidden />
      </div>
      <p className="text-sm text-muted-foreground">{status}</p>
    </div>
  );
}
