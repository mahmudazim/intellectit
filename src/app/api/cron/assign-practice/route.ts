import { NextResponse } from "next/server";

import { assignPracticeForAll } from "@/lib/mastery/recommend";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Har kecha: zaif mavzular bo'yicha o'quvchilarga mashq beradi.
 * `recompute-mastery` dan KEYIN ishlaydi — yangilangan baholar asosida.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 401 });
  }

  const { results, totalAssigned } = await assignPracticeForAll(3);

  return NextResponse.json({
    berildi: totalAssigned,
    oquvchilar: results.length,
    tafsilot: results.map((r) => ({
      oquvchi: r.studentName,
      vazifalar: r.assigned.map((a) => `${a.title} (${a.topicName})`),
      yaratildi: r.generated,
    })),
  });
}
