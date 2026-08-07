import { db } from "@/lib/db";
import { checkBadges } from "./badges";
import { recordActivity, streakBonus } from "./streak";
import { awardForQuiz, awardForSubmission } from "./xp";

export * from "./xp";
export * from "./streak";
export { checkBadges } from "./badges";

export type RewardResult = {
  xp: number;
  streak: number;
  newBadges: string[];
  milestone: number | null;
};

/**
 * Javob yoki test tugagandan keyin barcha mukofotlarni beradi.
 *
 * Tartib muhim:
 *   1. XP (asosiy mukofot)
 *   2. Streak (kunlik faollik) + chegara bonusi
 *   3. Nishonlar (yuqoridagilarga bog'liq bo'lishi mumkin)
 *
 * Hech qachon xato tashlamaydi — mukofot berilmasa ham o'quvchining
 * balli va javobi saqlangan bo'ladi.
 */
export async function grantRewards(
  userId: string,
  source: { type: "submission" | "quiz"; id: string }
): Promise<RewardResult> {
  const result: RewardResult = {
    xp: 0,
    streak: 0,
    newBadges: [],
    milestone: null,
  };

  try {
    result.xp =
      source.type === "submission"
        ? await awardForSubmission(source.id)
        : await awardForQuiz(source.id);

    const streak = await recordActivity(userId);
    result.streak = streak.current;
    result.milestone = streak.milestone;

    if (streak.milestone) {
      const bonus = streakBonus(streak.milestone);
      if (bonus) {
        const already = await db.xpEvent.findFirst({
          where: { userId, reason: bonus.reason },
          select: { id: true },
        });
        if (!already) {
          await db.xpEvent.create({
            data: { userId, amount: bonus.amount, reason: bonus.reason },
          });
          result.xp += bonus.amount;
        }
      }
    }

    result.newBadges = await checkBadges(userId);
  } catch (e) {
    console.error("[gamification] mukofot berishda xato:", e);
  }

  return result;
}
