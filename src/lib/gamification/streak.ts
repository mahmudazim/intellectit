import { db } from "@/lib/db";

/**
 * Streak — ketma-ket faol kunlar.
 *
 * Kunlik faollik = kamida bitta javob yuborilgan yoki test ishlangan.
 * Vaqt zonasi Asia/Tashkent — o'quvchi kechqurun 23:50 da yuborsa,
 * bu bugungi kun hisoblanishi kerak.
 *
 * "Freeze" — semestrda 2 marta bir kunni o'tkazib yuborish mumkin
 * (kasal bo'lish, internet yo'qligi). Streak buzilmaydi. Bu jazolamaslik
 * uchun: bitta o'tkazilgan kun uchun 40 kunlik mehnatni yo'qotish
 * o'quvchini butunlay to'xtatadi.
 */

const TZ = "Asia/Tashkent";

/** Berilgan vaqtni Toshkent kunining boshiga (00:00) keltiradi. */
export function tashkentDay(date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return new Date(`${parts}T00:00:00.000Z`);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export type StreakUpdate = {
  current: number;
  longest: number;
  /** Bugun birinchi marta faol bo'ldimi */
  isNewDay: boolean;
  /** Freeze ishlatildimi */
  usedFreeze: boolean;
  /** Streak yangi chegaraga yetdimi (7, 30, 100) */
  milestone: number | null;
};

/** Faollikni qayd etadi va streak'ni yangilaydi. */
export async function recordActivity(userId: string): Promise<StreakUpdate> {
  const today = tashkentDay();

  const streak = await db.streak.upsert({
    where: { userId },
    create: { userId, current: 1, longest: 1, lastActiveDay: today },
    update: {},
  });

  const last = streak.lastActiveDay ? tashkentDay(streak.lastActiveDay) : null;

  // Bugun allaqachon hisoblangan
  if (last && daysBetween(last, today) === 0) {
    return {
      current: streak.current,
      longest: streak.longest,
      isNewDay: false,
      usedFreeze: false,
      milestone: null,
    };
  }

  const gap = last ? daysBetween(last, today) : 1;
  let current = streak.current;
  let freezeCount = streak.freezeCount;
  let usedFreeze = false;

  if (!last || gap === 1) {
    // Ketma-ket kun
    current = streak.current + 1;
  } else if (gap === 2 && freezeCount > 0) {
    // Bir kun o'tkazib yuborildi — freeze ishlatamiz
    current = streak.current + 1;
    freezeCount -= 1;
    usedFreeze = true;
  } else {
    // Uzilib qoldi
    current = 1;
  }

  // Birinchi marta yaratilgan bo'lsa current allaqachon 1
  if (!streak.lastActiveDay && streak.current === 1) current = 1;

  const longest = Math.max(streak.longest, current);

  await db.streak.update({
    where: { userId },
    data: { current, longest, lastActiveDay: today, freezeCount },
  });

  const milestone = [100, 30, 7].find((m) => current === m) ?? null;

  return { current, longest, isNewDay: true, usedFreeze, milestone };
}

/** Streak chegarasi uchun XP bonusi. */
export function streakBonus(milestone: number): {
  amount: number;
  reason: "streak_7" | "streak_30" | "streak_100";
} | null {
  if (milestone === 7) return { amount: 50, reason: "streak_7" };
  if (milestone === 30) return { amount: 250, reason: "streak_30" };
  if (milestone === 100) return { amount: 1000, reason: "streak_100" };
  return null;
}

/** Bugun faol bo'lmaganlar — kechqurun eslatma yuborish uchun. */
export async function studentsAtRisk(): Promise<
  { userId: string; fullName: string; current: number }[]
> {
  const today = tashkentDay();

  const streaks = await db.streak.findMany({
    where: {
      current: { gte: 2 },
      OR: [{ lastActiveDay: { lt: today } }, { lastActiveDay: null }],
      user: { role: "STUDENT", isActive: true },
    },
    select: {
      userId: true,
      current: true,
      user: { select: { fullName: true } },
    },
  });

  return streaks.map((s) => ({
    userId: s.userId,
    fullName: s.user.fullName,
    current: s.current,
  }));
}
