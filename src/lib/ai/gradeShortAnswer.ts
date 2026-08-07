import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { db } from "@/lib/db";
import { estimateCost } from "./pricing";
import { isBudgetExceeded, logFailure, logUsage } from "./usage";

/**
 * Qisqa javoblarni AI bilan baholash.
 *
 * Aniq matn mosligi ishlamaganda ishlatiladi (masalan o'quvchi
 * "takrorlash uchun" deb yozdi, kutilgan javob "sikl" edi).
 *
 * ARZON model ishlatiladi (Haiku) — bu oddiy ish, Opus kerak emas.
 * Bir chaqiruvda barcha javoblar baholanadi.
 */

const BatchSchema = z.object({
  results: z.array(
    z.object({
      questionId: z.string(),
      isCorrect: z.boolean(),
      /** Qisqa izoh, o'zbekcha, 1 jumla */
      feedback: z.string(),
    })
  ),
});

const SYSTEM = `Sen maktab IT o'qituvchisining yordamchisisan.
O'quvchilarning qisqa javoblarini baholaysan.

Qoidalar:
- Javob MAZMUNAN to'g'ri bo'lsa — to'g'ri deb belgila. So'zma-so'z moslik shart emas.
  Masalan kutilgan "sikl", o'quvchi "takrorlanuvchi jarayon" deb yozgan bo'lsa — TO'G'RI.
- Imlo xatosi yoki apostrof farqi uchun ball kamaytirma.
- Javob bo'sh, mavzuga aloqasiz yoki mutlaqo noto'g'ri bo'lsa — noto'g'ri.
- feedback: o'zbek tilida, 1 qisqa jumla. To'g'ri bo'lsa qisqa tasdiq,
  noto'g'ri bo'lsa nima yetishmayotganini ayt (tayyor javobni yozib berma).`;

export async function gradeShortAnswers(attemptId: string): Promise<void> {
  try {
    if (await isBudgetExceeded()) return;

    const pending = await db.quizAnswer.findMany({
      where: { attemptId, isCorrect: null },
      select: {
        id: true,
        questionId: true,
        answerJson: true,
        question: {
          select: { prompt: true, correctText: true, points: true },
        },
      },
    });
    if (pending.length === 0) return;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Kalit yo'q — qo'lda tekshirish uchun o'qituvchiga qoldiramiz
      return;
    }

    const model = process.env.AI_MODEL_CHEAP || "claude-haiku-4-5";
    const started = Date.now();

    const items = pending
      .map((p) => {
        const a = p.answerJson as { type?: string; value?: string };
        return `questionId: ${p.questionId}
savol: ${p.question.prompt}
kutilgan javob: ${p.question.correctText ?? "-"}
o'quvchi javobi: ${a?.value ?? ""}`;
      })
      .join("\n---\n");

    const client = new Anthropic({ apiKey, maxRetries: 1 });
    const response = await client.messages.parse({
      model,
      max_tokens: 2000,
      system: SYSTEM,
      output_config: { format: zodOutputFormat(BatchSchema) },
      messages: [
        {
          role: "user",
          content: `Quyidagi javoblarni baholab, har biri uchun natija qaytar:\n\n${items}`,
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) return;

    const byQuestion = new Map(parsed.results.map((r) => [r.questionId, r]));
    let added = 0;

    for (const p of pending) {
      const verdict = byQuestion.get(p.questionId);
      if (!verdict) continue;
      const points = verdict.isCorrect ? p.question.points : 0;
      added += points;

      await db.quizAnswer.update({
        where: { id: p.id },
        data: {
          isCorrect: verdict.isCorrect,
          pointsEarned: points,
          aiFeedback: verdict.feedback,
        },
      });
    }

    if (added > 0) {
      await db.quizAttempt.update({
        where: { id: attemptId },
        data: { score: { increment: added } },
      });
    }

    const usage = response.usage;
    await logUsage(
      "grade_short_answer",
      {
        provider: "anthropic",
        model,
        tokensIn: usage.input_tokens ?? 0,
        tokensOut: usage.output_tokens ?? 0,
        cacheRead: usage.cache_read_input_tokens ?? 0,
        costUsd: estimateCost(
          model,
          usage.input_tokens ?? 0,
          usage.output_tokens ?? 0,
          usage.cache_read_input_tokens ?? 0
        ),
        latencyMs: Date.now() - started,
      },
      true
    );
  } catch (e) {
    // Javob baribir saqlangan — AI qo'shimcha ball bermasa ham test yakunlangan
    console.error("[ai] qisqa javob baholashda xato:", e);
    await logFailure(
      "grade_short_answer",
      "anthropic",
      process.env.AI_MODEL_CHEAP || "claude-haiku-4-5",
      e instanceof Error ? e.message.slice(0, 100) : "unknown"
    ).catch(() => {});
  }
}
