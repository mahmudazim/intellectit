import { db } from "@/lib/db";

/**
 * Nishonlar qoidalari dvigateli.
 *
 * Qoidalar `Badge.ruleJson` da saqlanadi (seed.ts da yaratilgan), shuning
 * uchun yangi nishon qo'shish uchun kod o'zgartirish shart emas —
 * bazaga yozuv qo'shiladi.
 */

type Rule =
  | { type: "solved_count"; count: number }
  | { type: "solved_after_attempts"; minAttempts: number }
  | { type: "code_quality"; min: number }
  | { type: "first_try_all_pass"; count: number }
  | { type: "early_submit"; hoursBefore: number; count: number }
  | { type: "streak"; days: number }
  | { type: "track_mastery"; track: string; min: number }
  | { type: "mastery_comeback"; from: number; to: number }
  | { type: "submit_hour_range"; from: number; to: number };

/** Toshkent vaqti bo'yicha soat. */
function tashkentHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tashkent",
      hour: "2-digit",
      hour12: false,
    }).format(date)
  );
}

async function ruleSatisfied(userId: string, rule: Rule): Promise<boolean> {
  switch (rule.type) {
    case "solved_count": {
      const n = await db.submission.count({
        where: {
          studentId: userId,
          status: "GRADED",
          testsTotal: { gt: 0 },
          // Kamida bitta test o'tgan
          testsPassed: { gt: 0 },
        },
      });
      return n >= rule.count;
    }

    case "solved_after_attempts": {
      const s = await db.submission.findFirst({
        where: {
          studentId: userId,
          attemptNo: { gte: rule.minAttempts },
          testsTotal: { gt: 0 },
        },
        select: { testsPassed: true, testsTotal: true },
        orderBy: { createdAt: "desc" },
      });
      return Boolean(s && s.testsPassed === s.testsTotal);
    }

    case "code_quality": {
      const n = await db.aiReview.count({
        where: {
          status: "DONE",
          codeQuality: { gte: rule.min },
          submission: { studentId: userId },
        },
      });
      return n > 0;
    }

    case "first_try_all_pass": {
      const subs = await db.submission.findMany({
        where: { studentId: userId, attemptNo: 1, testsTotal: { gt: 0 } },
        select: { testsPassed: true, testsTotal: true },
      });
      return subs.filter((s) => s.testsPassed === s.testsTotal).length >= rule.count;
    }

    case "early_submit": {
      const subs = await db.submission.findMany({
        where: { studentId: userId, submittedAt: { not: null }, isLate: false },
        select: { assignmentId: true, submittedAt: true },
      });
      if (subs.length === 0) return false;

      const targets = await db.assignmentTarget.findMany({
        where: {
          assignmentId: { in: subs.map((s) => s.assignmentId) },
          dueAt: { not: null },
        },
        select: { assignmentId: true, dueAt: true },
      });
      const dueBy = new Map(targets.map((t) => [t.assignmentId, t.dueAt!]));

      const early = subs.filter((s) => {
        const due = dueBy.get(s.assignmentId);
        if (!due || !s.submittedAt) return false;
        return (due.getTime() - s.submittedAt.getTime()) / 3600000 >= rule.hoursBefore;
      });
      return early.length >= rule.count;
    }

    case "streak": {
      const s = await db.streak.findUnique({
        where: { userId },
        select: { longest: true },
      });
      return (s?.longest ?? 0) >= rule.days;
    }

    case "track_mastery": {
      const topics = await db.topic.findMany({
        where: { module: { track: rule.track as never } },
        select: { id: true },
      });
      if (topics.length === 0) return false;

      const mastered = await db.topicMastery.count({
        where: {
          userId,
          topicId: { in: topics.map((t) => t.id) },
          score: { gte: rule.min },
          confidence: { gte: 0.4 },
        },
      });
      return mastered === topics.length;
    }

    case "mastery_comeback": {
      // Bir mavzuda `from` dan pastga tushib, keyin `to` dan yuqoriga chiqqan
      const events = await db.masteryEvent.findMany({
        where: { userId, source: { not: "decay" } },
        orderBy: { createdAt: "asc" },
        select: { topicId: true, scoreAfter: true },
        take: 500,
      });

      const wasLow = new Set<string>();
      for (const e of events) {
        if (e.scoreAfter < rule.from) wasLow.add(e.topicId);
        else if (e.scoreAfter >= rule.to && wasLow.has(e.topicId)) return true;
      }
      return false;
    }

    case "submit_hour_range": {
      const subs = await db.submission.findMany({
        where: { studentId: userId, submittedAt: { not: null } },
        select: { submittedAt: true },
        take: 200,
        orderBy: { createdAt: "desc" },
      });
      return subs.some((s) => {
        const h = tashkentHour(s.submittedAt!);
        return h >= rule.from && h <= rule.to;
      });
    }

    default:
      return false;
  }
}

/**
 * Barcha nishonlarni tekshiradi va yangilarini beradi.
 * Har javob/test tugagandan keyin chaqiriladi.
 */
export async function checkBadges(userId: string): Promise<string[]> {
  const [badges, owned] = await Promise.all([
    db.badge.findMany({ select: { id: true, slug: true, name: true, ruleJson: true } }),
    db.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
  ]);

  const ownedIds = new Set(owned.map((o) => o.badgeId));
  const earned: string[] = [];

  for (const badge of badges) {
    if (ownedIds.has(badge.id)) continue;

    let ok = false;
    try {
      ok = await ruleSatisfied(userId, badge.ruleJson as Rule);
    } catch {
      // Bitta nishon qoidasi buzilsa qolganlari tekshirilishda davom etsin
      continue;
    }
    if (!ok) continue;

    await db.userBadge.create({ data: { userId, badgeId: badge.id } });
    // Nishon uchun kichik XP
    await db.xpEvent.create({
      data: { userId, amount: 25, reason: "badge", refId: badge.id },
    });
    earned.push(badge.name);
  }

  return earned;
}
