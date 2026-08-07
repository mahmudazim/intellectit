import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { db } from "@/lib/db";
import { outputsMatch, runCode } from "@/lib/sandbox";
import { estimateCost } from "./pricing";
import { isBudgetExceeded, logFailure, logUsage } from "./usage";

/**
 * Mavzu bo'yicha test savollarini AI yaratadi.
 *
 * MUHIM: yaratilgan savollar `isApproved: false` bilan saqlanadi —
 * o'qituvchi ko'rib tasdiqlamaguncha testga qo'shilmaydi.
 */

const GeneratedSchema = z.object({
  questions: z.array(
    z.object({
      type: z.enum(["MCQ_SINGLE", "MCQ_MULTI", "TRUE_FALSE", "CODE_OUTPUT"]),
      prompt: z.string(),
      codeSnippet: z.string().nullable(),
      options: z
        .array(z.object({ text: z.string(), isCorrect: z.boolean() }))
        .nullable(),
      correctText: z.string().nullable(),
      explanation: z.string(),
      difficulty: z.number().min(1).max(5),
    })
  ),
});

const SYSTEM = `Sen maktab IT o'qituvchisiga test savollarini tayyorlaysan.
O'quvchilar 12-17 yoshda, Python va HTML/CSS o'rganishmoqda.

Qoidalar:
- Savol va variantlar FAQAT o'zbek tilida (lotin alifbosi). Kod inglizcha qoladi.
- Savol aniq va bir ma'noli bo'lsin. "Qaysi biri to'g'ri emas?" kabi chalkash
  savollardan qoch.
- MCQ_SINGLE / TRUE_FALSE: aynan bitta variant to'g'ri.
- MCQ_MULTI: 2 yoki 3 ta variant to'g'ri.
- CODE_OUTPUT: codeSnippet ber, correctText — kodning aniq chiqishi
  (bo'shliqlarsiz, faqat natija matni). options null bo'lsin.
- Noto'g'ri variantlar ISHONARLI bo'lsin — o'quvchi haqiqatan qiynaladigan
  tipik xatolar asosida (masalan range chegarasi, indeks 0 dan boshlanishi).
  Kulgili yoki mutlaqo aloqasiz variant yozma.
- explanation: nega shu javob to'g'ri ekanini 1-2 jumlada tushuntir.
- Har xil qiyinlikda ber: oson, o'rta, qiyin aralash.`;

export type GenerateResult =
  | { ok: true; created: number; rejected: number }
  | { ok: false; error: string };

export async function generateQuestionsForTopic(
  topicId: string,
  count = 5
): Promise<GenerateResult> {
  try {
    if (await isBudgetExceeded()) {
      return { ok: false, error: "Oylik AI byudjeti tugadi." };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "ANTHROPIC_API_KEY sozlanmagan." };
    }

    const topic = await db.topic.findUnique({
      where: { id: topicId },
      select: {
        name: true,
        description: true,
        difficulty: true,
        module: { select: { name: true, track: true } },
      },
    });
    if (!topic) return { ok: false, error: "Mavzu topilmadi." };

    // Takror savol yaratmaslik uchun mavjudlarini ko'rsatamiz
    const existing = await db.question.findMany({
      where: { topicId },
      select: { prompt: true },
      take: 30,
    });

    const model = process.env.AI_MODEL_GRADE || "claude-opus-5";
    const started = Date.now();
    const client = new Anthropic({ apiKey, maxRetries: 1 });

    const response = await client.messages.parse({
      model,
      max_tokens: 6000,
      system: SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(GeneratedSchema) },
      messages: [
        {
          role: "user",
          content: `Mavzu: ${topic.name}
Yo'nalish: ${topic.module.track}, modul: ${topic.module.name}
Tavsif: ${topic.description ?? "-"}
Mavzu qiyinligi: ${topic.difficulty}/5

${count} ta test savoli yarat.

${
  existing.length > 0
    ? `Quyidagi savollar allaqachon bor — ularni TAKRORLAMA:\n${existing
        .map((e) => `- ${e.prompt.slice(0, 90)}`)
        .join("\n")}`
    : ""
}`,
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) return { ok: false, error: "AI javobini o'qib bo'lmadi." };

    let created = 0;
    let rejected = 0;

    for (const q of parsed.questions) {
      const isChoice = q.type !== "CODE_OUTPUT";

      // Ishonchsiz natijalarni tashlab yuboramiz
      if (isChoice) {
        if (!q.options || q.options.length < 2) continue;
        const correctCount = q.options.filter((o) => o.isCorrect).length;
        if (correctCount === 0) continue;
        if (q.type !== "MCQ_MULTI" && correctCount !== 1) continue;
      } else {
        if (!q.correctText?.trim()) continue;

        // CODE_OUTPUT: AI aytgan javobni sandbox'da TEKSHIRAMIZ.
        // AI kod natijasini xato hisoblashi mumkin — noto'g'ri savol
        // o'quvchiga yetib bormasligi kerak.
        if (!q.codeSnippet?.trim()) continue;
        const run = await runCode("python", q.codeSnippet, "");
        if (run.infraError || run.timedOut || run.stderr.trim()) {
          rejected += 1;
          continue;
        }
        if (!outputsMatch(q.correctText, run.stdout)) {
          console.warn(
            `[ai] savol rad etildi: AI "${q.correctText.trim()}" dedi, ` +
              `sandbox "${run.stdout.trim()}" chiqardi`
          );
          rejected += 1;
          continue;
        }
      }

      await db.question.create({
        data: {
          topicId,
          type: q.type,
          prompt: q.prompt,
          codeSnippet: q.codeSnippet,
          options: isChoice
            ? q.options!.map((o, i) => ({
                id: `o${i}`,
                text: o.text,
                isCorrect: o.isCorrect,
              }))
            : undefined,
          correctText: isChoice ? null : q.correctText,
          explanation: q.explanation,
          difficulty: Math.round(q.difficulty),
          points: 1,
          source: "AI_GENERATED",
          // O'qituvchi tasdiqlamaguncha ishlatilmaydi
          isApproved: false,
        },
      });
      created += 1;
    }

    const usage = response.usage;
    await logUsage(
      "generate_quiz",
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

    return { ok: true, created, rejected };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logFailure("generate_quiz", "anthropic", "-", msg.slice(0, 100)).catch(
      () => {}
    );
    return { ok: false, error: msg.slice(0, 200) };
  }
}
