import { NextResponse } from "next/server";

import { studentsAtRisk } from "@/lib/gamification/streak";
import { notifyStreakWarning } from "@/lib/telegram/notify";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Kechqurun 20:00 (Toshkent): bugun hali mashq qilmagan, lekin streak'i
 * bor o'quvchilarga eslatma.
 *
 * Faqat streak >= 2 bo'lganlarga — yo'qotadigan narsasi borlarga.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 401 });
  }

  const atRisk = await studentsAtRisk();
  let sent = 0;

  for (const s of atRisk) {
    const ok = await notifyStreakWarning(s.userId, s.current);
    if (ok) sent += 1;
  }

  return NextResponse.json({ xavfda: atRisk.length, yuborildi: sent });
}
