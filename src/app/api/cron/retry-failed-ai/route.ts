import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { gradeSubmissionWithAi } from "@/lib/ai/gradeSubmission";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Muvaffaqiyatsiz AI baholashlarni qayta urinib ko'radi.
 *
 * Nega kerak: ikkala provayder ham bir vaqtda yiqilishi mumkin (tarmoq,
 * limit). Test natijasi saqlangan, lekin o'quvchi izohsiz qoladi.
 * Bu cron ularni oxiriga yetkazadi.
 *
 * Vercel Cron har 30 daqiqada chaqiradi.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 401 });
  }

  // PENDING holatida 10 daqiqadan ko'p turganlar ham qayta urinilsin —
  // `after()` server qayta ishga tushganda uzilib qolishi mumkin.
  const stuckBefore = new Date(Date.now() - 10 * 60 * 1000);

  const candidates = await db.aiReview.findMany({
    where: {
      OR: [
        { status: "FAILED", retryCount: { lt: 3 } },
        { status: "PENDING", createdAt: { lt: stuckBefore } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { submissionId: true },
  });

  let done = 0;
  for (const c of candidates) {
    await gradeSubmissionWithAi(c.submissionId);
    done += 1;
  }

  return NextResponse.json({ tekshirildi: candidates.length, bajarildi: done });
}
