import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { weeklyXp } from "@/lib/gamification/xp";
import { getWeakTopics } from "@/lib/mastery/weakTopics";
import { esc, notify, notifyTeacher } from "@/lib/telegram/notify";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Haftalik hisobot (yakshanba 19:00 Toshkent).
 *
 * O'quvchiga: bu haftada nima qildi, nimani mustahkamlash kerak.
 * O'qituvchiga: sinf bo'yicha umumiy holat.
 *
 * AI ishlatilmaydi — barcha ma'lumot allaqachon hisoblangan
 * (mastery, XP). Har hafta 30 ta AI chaqiruvi qilish keraksiz xarajat.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 401 });
  }

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const students = await db.user.findMany({
    where: { role: "STUDENT", isActive: true, telegramId: { not: null } },
    select: { id: true, fullName: true },
  });

  let sent = 0;

  for (const s of students) {
    const [xp, solved, quizzes, weak, streak] = await Promise.all([
      weeklyXp(s.id),
      db.submission.count({
        where: {
          studentId: s.id,
          status: "GRADED",
          gradedAt: { gte: since },
          testsPassed: { gt: 0 },
        },
      }),
      db.quizAttempt.count({
        where: { studentId: s.id, submittedAt: { gte: since } },
      }),
      getWeakTopics(s.id, 2),
      db.streak.findUnique({ where: { userId: s.id } }),
    ]);

    // Umuman faol bo'lmagan o'quvchiga boshqacha xabar
    const active = xp > 0 || solved > 0 || quizzes > 0;

    const body = active
      ? `📊 <b>Haftalik hisobot</b>\n\n` +
        `⚡ ${xp} XP to'pladingiz\n` +
        `✅ ${solved} ta vazifa · ${quizzes} ta test\n` +
        (streak?.current ? `🔥 ${streak.current} kunlik streak\n` : "") +
        (weak.length > 0
          ? `\n<b>Keyingi hafta ustida ishlash kerak:</b>\n` +
            weak
              .map((w) => `• ${esc(w.name)} (${Math.round(w.score * 100)}%)`)
              .join("\n")
          : `\nHamma mavzu joyida — zo'r ish!`)
      : `👋 <b>Bu hafta sizni ko'rmadik</b>\n\n` +
        `Bitta vazifa ham 15 daqiqa vaqt oladi. Kelasi hafta boshlaymizmi?` +
        (weak.length > 0
          ? `\n\nShu mavzudan boshlash mumkin: <b>${esc(weak[0].name)}</b>`
          : "");

    const ok = await notify(s.id, "weeklyReport", body, {
      label: "Platformani ochish",
      path: active ? "/progress" : "/assignments",
    });
    if (ok) sent += 1;
  }

  // ---- O'qituvchiga sinf xulosasi ----
  const [totalSubs, gradedSubs, activeStudents, pendingReview] =
    await Promise.all([
      db.submission.count({
        where: { createdAt: { gte: since }, status: { not: "DRAFT" } },
      }),
      db.submission.count({
        where: { gradedAt: { gte: since }, testsPassed: { gt: 0 } },
      }),
      db.user.count({
        where: {
          role: "STUDENT",
          isActive: true,
          submissions: { some: { createdAt: { gte: since } } },
        },
      }),
      db.assignment.count({ where: { status: "PENDING_REVIEW" } }),
    ]);

  const allStudents = await db.user.count({
    where: { role: "STUDENT", isActive: true },
  });

  await notifyTeacher(
    `📊 <b>Haftalik xulosa</b>\n\n` +
      `👥 ${activeStudents}/${allStudents} o'quvchi faol edi\n` +
      `📝 ${totalSubs} ta javob · ${gradedSubs} tasi muvaffaqiyatli\n` +
      (pendingReview > 0
        ? `\n⏳ ${pendingReview} ta AI vazifasi tasdiqlashingizni kutmoqda`
        : "")
  );

  return NextResponse.json({ oquvchilar: students.length, yuborildi: sent });
}
