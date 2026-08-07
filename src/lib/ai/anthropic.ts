import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { estimateCost } from "./pricing";
import { buildStudentBlock, buildTaskContext } from "./prompts/gradeCode";
import { BASE_RUBRIC } from "./prompts/rubric";
import { GradeSchema, normalizeGrade } from "./schemas";
import { AiError, type AiProvider, type GradeInput, type GradeOutcome } from "./types";

/**
 * Claude adapteri — asosiy provayder.
 * Bu faylda FAQAT @anthropic-ai/sdk ishlatiladi (OpenAI bilan aralashtirilmaydi).
 */

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new AiError("ANTHROPIC_API_KEY o'rnatilmagan.", "retryable", "anthropic");
    }
    client = new Anthropic({ apiKey, maxRetries: 1 });
  }
  return client;
}

/** SDK xatosini failover qaroriga aylantiradi. */
function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;

  if (e instanceof Anthropic.APIError) {
    const status = e.status ?? 0;
    // 400 — bizning so'rovimizdagi xato. Boshqa provayder ham rad etadi.
    const kind = status === 400 ? "fatal" : "retryable";
    return new AiError(
      `Claude ${status}: ${e.message}`.slice(0, 300),
      kind,
      "anthropic",
      status
    );
  }

  const msg = e instanceof Error ? e.message : String(e);
  return new AiError(`Claude xatosi: ${msg}`.slice(0, 300), "retryable", "anthropic");
}

export const anthropicProvider: AiProvider = {
  name: "anthropic",

  async gradeCode(input: GradeInput): Promise<GradeOutcome> {
    const model = process.env.AI_MODEL_GRADE || "claude-opus-5";
    // O'lchangan: high → 33s / $0.040, medium → 25s / $0.020, low → 15s / $0.015.
    // Uchalasida ham ball va izoh sifati bir xil chiqdi, shuning uchun
    // standart "medium" — maktab byudjeti uchun ikki barobar arzon.
    const effort = (process.env.AI_EFFORT || "medium") as
      | "low"
      | "medium"
      | "high";
    const started = Date.now();

    try {
      const response = await getClient().messages.parse({
        model,
        max_tokens: 4000,
        // Kesh tartibi: rubrika (hech qachon o'zgarmaydi) → vazifa konteksti
        // (bitta vazifa uchun bir xil). O'quvchi kodi messages'da, oxirida.
        system: [
          { type: "text", text: BASE_RUBRIC },
          {
            type: "text",
            text: buildTaskContext(input),
            cache_control: { type: "ephemeral" },
          },
        ],
        output_config: { effort, format: zodOutputFormat(GradeSchema) },
        messages: [{ role: "user", content: buildStudentBlock(input) }],
      });

      // Xavfsizlik klassifikatori rad etsa — content bo'sh bo'ladi
      if (response.stop_reason === "refusal") {
        throw new AiError(
          "Claude so'rovni rad etdi (refusal).",
          "retryable",
          "anthropic"
        );
      }

      const parsed = response.parsed_output;
      if (!parsed) {
        throw new AiError(
          "Claude javobini o'qib bo'lmadi (parsed_output bo'sh).",
          "retryable",
          "anthropic"
        );
      }

      const usage = response.usage;
      const tokensIn = usage.input_tokens ?? 0;
      const tokensOut = usage.output_tokens ?? 0;
      const cacheRead = usage.cache_read_input_tokens ?? 0;
      const cacheWrite = usage.cache_creation_input_tokens ?? 0;

      return {
        result: normalizeGrade(parsed, input.topicSlugs, input.primaryTopicSlug),
        meta: {
          provider: "anthropic",
          model,
          // Kesh yozilgan tokenlar ham kirishga kiradi
          tokensIn: tokensIn + cacheRead + cacheWrite,
          tokensOut,
          cacheRead,
          costUsd: estimateCost(
            model,
            tokensIn + cacheRead + cacheWrite,
            tokensOut,
            cacheRead
          ),
          latencyMs: Date.now() - started,
        },
      };
    } catch (e) {
      throw toAiError(e);
    }
  },
};
