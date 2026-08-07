import { anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";
import { AiError, type AiProvider, type GradeInput, type GradeOutcome } from "./types";
import { isBudgetExceeded, logFailure, logUsage } from "./usage";

/**
 * Provayderlar o'rtasida avtomatik almashinuv (failover).
 *
 * Qoidalar:
 *  - 429 / 401 / 403 / 5xx / tarmoq xatosi / refusal  → zaxira provayderga o't
 *  - 400 (bizning so'rovimizdagi xato)                → o'tILMAYDI, xato qaytariladi
 *  - Ikkalasi ham yiqilsa                             → BudgetOrFailure qaytariladi
 *
 * Byudjet tugagan bo'lsa umuman chaqirmaymiz — test-case bahosi baribir ishlaydi.
 */

export type GradeAttempt =
  | { status: "ok"; outcome: GradeOutcome }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

function providersInOrder(): AiProvider[] {
  const primaryName = process.env.AI_PRIMARY === "openai" ? "openai" : "anthropic";
  return primaryName === "openai"
    ? [openaiProvider, anthropicProvider]
    : [anthropicProvider, openaiProvider];
}

/** Provayder umuman sozlanganmi? */
function isConfigured(p: AiProvider): boolean {
  return p.name === "anthropic"
    ? Boolean(process.env.ANTHROPIC_API_KEY)
    : Boolean(process.env.OPENAI_API_KEY);
}

export async function gradeWithFailover(
  input: GradeInput
): Promise<GradeAttempt> {
  if (await isBudgetExceeded()) {
    return {
      status: "skipped",
      reason:
        "Oylik AI byudjeti tugadi. Test natijasi saqlandi, AI izohi berilmadi.",
    };
  }

  const chain = providersInOrder().filter(isConfigured);
  if (chain.length === 0) {
    return {
      status: "skipped",
      reason: "AI kaliti sozlanmagan (ANTHROPIC_API_KEY / OPENAI_API_KEY).",
    };
  }

  const errors: string[] = [];

  for (const [index, provider] of chain.entries()) {
    try {
      const outcome = await provider.gradeCode(input);
      await logUsage("grade_code", outcome.meta, true);
      return { status: "ok", outcome };
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError(String(e), "retryable", provider.name);
      errors.push(err.message);

      await logFailure(
        "grade_code",
        provider.name,
        "-",
        `${err.kind}:${err.status ?? "-"}`
      );

      // 400 — bizning xatomiz. Zaxira provayder ham xuddi shu xatoni beradi.
      if (err.kind === "fatal") {
        return { status: "failed", error: err.message };
      }

      const isLast = index === chain.length - 1;
      if (!isLast) {
        console.warn(
          `[ai] ${provider.name} ishlamadi (${err.message}). ` +
            `Zaxiraga o'tilmoqda: ${chain[index + 1].name}`
        );
      }
    }
  }

  return { status: "failed", error: errors.join(" | ").slice(0, 500) };
}
