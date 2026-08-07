"use client";

import { useEffect } from "react";

/**
 * Service worker'ni ro'yxatdan o'tkazadi.
 * Dev rejimida o'chirilgan — HMR bilan to'qnashadi.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((e) => {
        console.warn("[sw] ro'yxatdan o'tkazib bo'lmadi:", e);
      });
    };

    // Sahifa yuklanishini sekinlashtirmasligi uchun kutamiz
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
