import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { notifyDueReminder } from "@/lib/telegram/notify";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Muddat eslatmasi — 24 soatdan kam qolgan, hali bajarilmagan vazifalar.
 * Har kuni bir marta (16:00 Toshkent) ishlaydi.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 401 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000);

  const targets = await db.assignmentTarget.findMany({
    where: {
      dueAt: { gt: now, lte: in24h },
      assignment: { status: "PUBLISHED" },
    },
    select: {
      dueAt: true,
      userId: true,
      groupId: true,
      assignment: { select: { id: true, title: true } },
    },
  });

  let sent = 0;

  for (const t of targets) {
    // Guruhga berilgan bo'lsa — a'zolarini olamiz
    const studentIds = t.userId
      ? [t.userId]
      : t.groupId
        ? (
            await db.groupMember.findMany({
              where: { groupId: t.groupId, user: { isActive: true } },
              select: { userId: true },
            })
          ).map((m) => m.userId)
        : [];

    for (const studentId of studentIds) {
      // Allaqachon bajargan bo'lsa eslatma yubormaymiz
      const done = await db.submission.findFirst({
        where: {
          studentId,
          assignmentId: t.assignment.id,
          status: "GRADED",
          testsPassed: { gt: 0 },
        },
        select: { id: true },
      });
      if (done) continue;

      const hoursLeft = Math.max(
        1,
        Math.round((t.dueAt!.getTime() - now.getTime()) / 3600000)
      );
      const ok = await notifyDueReminder(
        studentId,
        t.assignment.title,
        t.assignment.id,
        hoursLeft
      );
      if (ok) sent += 1;
    }
  }

  return NextResponse.json({ tekshirildi: targets.length, yuborildi: sent });
}
