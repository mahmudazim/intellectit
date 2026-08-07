"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Kod qoralamasini avtomatik saqlash.
 *
 * NEGA MUHIM: telefon brauzeri fon rejimida tabni o'chirib yuboradi. Agar
 * o'quvchi 20 daqiqa yozgan kodi yo'qolsa, u platformaga qaytmaydi.
 *
 * Ikki qatlam:
 *  - localStorage: har 1.5 soniyada (tez, internetsiz ham ishlaydi)
 *  - server: har 20 soniyada (boshqa qurilmadan davom ettirish uchun)
 */

const LOCAL_DELAY = 1500;
const SERVER_DELAY = 20000;

export type DraftStatus = "idle" | "saving" | "saved" | "offline";

export function useDraft(assignmentId: string, code: string, enabled = true) {
  const [status, setStatus] = useState<DraftStatus>("idle");
  const lastServerSave = useRef(0);
  const lastSentCode = useRef<string | null>(null);
  const storageKey = `intellectit:draft:${assignmentId}`;

  // --- localStorage ---
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ code, at: Date.now() })
        );
      } catch {
        /* xotira to'lgan yoki private rejim — jim o'tamiz */
      }
    }, LOCAL_DELAY);
    return () => clearTimeout(t);
  }, [code, enabled, storageKey]);

  // --- server ---
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(async () => {
      if (Date.now() - lastServerSave.current < SERVER_DELAY) return;
      if (lastSentCode.current === code) return;
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }

      setStatus("saving");
      try {
        const res = await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentId, code, draft: true }),
        });
        if (res.ok) {
          lastServerSave.current = Date.now();
          lastSentCode.current = code;
          setStatus("saved");
        } else {
          setStatus("idle");
        }
      } catch {
        setStatus("offline");
      }
    }, SERVER_DELAY);
    return () => clearTimeout(t);
  }, [assignmentId, code, enabled]);

  /** Saqlangan qoralamani o'qish (sahifa ochilganda). */
  const readLocal = useCallback((): { code: string; at: number } | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { code: string; at: number };
      return typeof parsed?.code === "string" ? parsed : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const clearLocal = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* e'tiborsiz */
    }
  }, [storageKey]);

  return { status, readLocal, clearLocal };
}
