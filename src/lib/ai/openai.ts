import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { estimateCost } from "./pricing";
import { buildStudentBlock, buildTaskContext } from "./prompts/gradeCode";
import { BASE_RUBRIC } from "./prompts/rubric";
import { GradeSchema, normalizeGrade } from "./schemas";
import { AiError, type AiProvider, type GradeInput, type GradeOutcome } from "./types";

/**
 * OpenAI adapteri — ZAXIRA provayder.
 * Claude ishlamay qolganda (limit tugadi, kalit bekor qilindi, xizmat yiqildi)
 * shu ishlaydi. Bu faylda FAQAT openai SDK ishlatiladi.
 */

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AiError("OPENAI_API_KEY o'rnatilmagan.", "retryable", "openai");
    }
    client = new OpenAI({ apiKey, maxRetries: 1 });
  }
  return client;
}

function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;

  if (e instanceof OpenAI.APIError) {
    const status = e.status ?? 0;
    const kind = status === 400 ? "fatal" : "retryable";
    return new AiError(
      `OpenAI ${status}: ${e.message}`.slice(0, 300),
      kind,
      "openai",
      status
    );
  }

  const msg = e instanceof Error ? e.message : String(e);
  return new AiError(`OpenAI xatosi: ${msg}`.slice(0, 300), "retryable", "openai");
}

export const openaiProvider: AiProvider = {
  name: "openai",

  async gradeCode(input: GradeInput): Promise<GradeOutcome> {
    const model = process.env.AI_MODEL_GRADE_OPENAI || "gpt-5";
    const started = Date.now();

    try {
      const response = await getClient().responses.parse({
        model,
        input: [
          { role: "system", content: `${BASE_RUBRIC}\n\n${buildTaskContext(input)}` },
          { role: "user", content: buildStudentBlock(input) },
        ],
        text: { format: zodTextFormat(GradeSchema, "grade") },
      });

      const parsed = response.output_parsed;
      if (!parsed) {
        throw new AiError(
          "OpenAI javobini o'qib bo'lmadi.",
          "retryable",
          "openai"
        );
      }

      const tokensIn = response.usage?.input_tokens ?? 0;
      const tokensOut = response.usage?.output_tokens ?? 0;
      const cacheRead = response.usage?.input_tokens_details?.cached_tokens ?? 0;

      return {
        result: normalizeGrade(parsed, input.topicSlugs, input.primaryTopicSlug),
        meta: {
          provider: "openai",
          model,
          tokensIn,
          tokensOut,
          cacheRead,
          costUsd: estimateCost(model, tokensIn, tokensOut, cacheRead),
          latencyMs: Date.now() - started,
        },
      };
    } catch (e) {
      throw toAiError(e);
    }
  },
};
