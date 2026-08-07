import { db } from "@/lib/db";
import type { AiMeta } from "./types";

/**
 * AI xarajatini kuzatish va oylik limitni ushlab turish.
 *
 * Maktab byudjeti cheklangan — kutilmagan hisob kelmasligi kerak.
 * Limit oshsa AI baholash o'chadi, lekin test-case tekshiruvi ishlashda
 * davom etadi (o'quvchi ballsiz qolmaydi).
 */

export async function logUsage(
  operation: string,
  meta: AiMeta,
  success: boolean,
  errorType?: string
) {
  await db.aiUsageLog.create({
    data: {
      provider: meta.provider,
      model: meta.model,
      operation,
      tokensIn: meta.tokensIn,
      tokensOut: meta.tokensOut,
      cacheRead: meta.cacheRead,
      costUsd: meta.costUsd,
      latencyMs: meta.latencyMs,
      success,
      errorType,
    },
  });
}

export async function logFailure(
  operation: string,
  provider: string,
  model: string,
  errorType: string
) {
  await db.aiUsageLog.create({
    data: {
      provider,
      model,
      operation,
      costUsd: 0,
      success: false,
      errorType,
    },
  });
}

/** Shu oyda sarflangan summa (USD). */
export async function monthlySpend(): Promise<number> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const agg = await db.aiUsageLog.aggregate({
    where: { createdAt: { gte: start } },
    _sum: { costUsd: true },
  });

  return Number(agg._sum.costUsd ?? 0);
}

export function monthlyBudget(): number {
  const raw = Number(process.env.AI_MONTHLY_BUDGET_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

/** Byudjet tugagan bo'lsa AI chaqiruvlari o'tkazib yuboriladi. */
export async function isBudgetExceeded(): Promise<boolean> {
  return (await monthlySpend()) >= monthlyBudget();
}
