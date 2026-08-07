import type { z } from "zod";
import type { GradeSchema } from "./schemas";

export type ProviderName = "anthropic" | "openai";

export type AiMeta = {
  provider: ProviderName;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  costUsd: number;
  latencyMs: number;
};

export type GradeResult = z.infer<typeof GradeSchema>;

/** Baholash uchun kiruvchi ma'lumot. */
export type GradeInput = {
  assignment: {
    title: string;
    description: string;
    type: string;
    language: string;
    difficulty: number;
    /** O'qituvchining qo'shimcha baholash mezoni (ixtiyoriy) */
    rubric?: string | null;
  };
  /** Mavjud mavzu slug'lari — AI faqat shulardan tanlaydi */
  topicSlugs: string[];
  /** Vazifaning asosiy mavzusi */
  primaryTopicSlug: string;
  studentCode: string;
  testSummary: {
    passed: number;
    total: number;
    failures: { expected: string; actual: string; stderr: string | null }[];
  };
};

export type GradeOutcome = { result: GradeResult; meta: AiMeta };

export interface AiProvider {
  readonly name: ProviderName;
  gradeCode(input: GradeInput): Promise<GradeOutcome>;
}

/**
 * Failover qaroriga yordam beruvchi xato turi.
 *
 * `retryable` — boshqa provayder yordam berishi mumkin.
 * `fatal` — bizning so'rovimizda xato (400), boshqa provayder ham rad etadi.
 */
export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: "retryable" | "fatal",
    readonly provider: ProviderName,
    readonly status?: number
  ) {
    super(message);
    this.name = "AiError";
  }
}
