import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { db } from "@/lib/db";
import { runTestCases } from "@/lib/sandbox";
import { estimateCost } from "./pricing";
import { isBudgetExceeded, logFailure, logUsage } from "./usage";

/**
 * Mavzu bo'yicha yangi mashq vazifasini AI yaratadi.
 *
 * UCH BOSQICHLI ISHONCH:
 *  1. Strukturali chiqish (Zod) — shakl kafolatlangan
 *  2. Sandbox validatsiyasi — AI yozgan YECHIM o'zining test-case'laridan
 *     o'tishi tekshiriladi. O'tmasa — bekor qilinadi.
 *  3. O'qituvchi tasdiqlashi (status = PENDING_REVIEW)
 *
 * Ikkinchi bosqich eng muhimi: AI ba'zan test-case kutilgan natijasini
 * xato hisoblaydi. Buzuq vazifa o'quvchini chalkashtiradi va platformaga
 * bo'lgan ishonchni yo'qotadi.
 */

const AssignmentSchema = z.object({
  title: z.string(),
  /** Markdown, o'zbekcha */
  description: z.string(),
  starterCode: z.string(),
  solutionCode: z.string(),
  testCases: z.array(
    z.object({
      stdin: z.string(),
      expectedStdout: z.string(),
      isHidden: z.boolean(),
    })
  ),
});

const SYSTEM = `Sen maktab IT o'qituvchisiga Python mashq vazifalarini tayyorlaysan.
O'quvchilar 12-17 yoshda.

Qoidalar:
- Sarlavha va shart FAQAT o'zbek tilida (lotin alifbosi).
- Shart aniq bo'lsin: nima kiritiladi, nima chiqarilishi kerak.
  Kirish va chiqish formatini aniq yoz.
- Vazifa FAQAT input() orqali ma'lumot oladi va print() orqali chiqaradi.
  Fayl, tarmoq, kutubxona (import) ISHLATMA — sandbox'da ishlamaydi.
- solutionCode — to'liq ishlaydigan yechim. Uni biz avtomatik tekshiramiz.
- testCases: 4-6 ta. Oddiy holatdan boshlab chegara holatlarigacha
  (masalan 0, 1, manfiy son, katta son). 2 tasi isHidden: true bo'lsin.
- expectedStdout — kodning AYNAN chiqishi. Ortiqcha bo'sh joy yoki
  qo'shimcha matn bo'lmasin.
- starterCode — bir-ikki qator boshlang'ich (masalan input o'qish) va
  izoh. Yechimni bermа.
- Vazifa berilgan mavzuni mashq qildirsin, undan chetga chiqmasin.`;

export type GeneratedAssignment =
  | { ok: true; assignmentId: string; title: string }
  | { ok: false; error: string };

export async function generateAssignmentForTopic(
  topicId: string,
  difficulty: number,
  createdById: string
): Promise<GeneratedAssignment> {
  try {
    if (await isBudgetExceeded()) {
      return { ok: false, error: "Oylik AI byudjeti tugadi." };
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY sozlanmagan." };

    const topic = await db.topic.findUnique({
      where: { id: topicId },
      select: {
        name: true,
        description: true,
        module: { select: { name: true } },
      },
    });
    if (!topic) return { ok: false, error: "Mavzu topilmadi." };

    // Takrorlanmasligi uchun mavjud vazifalarni ko'rsatamiz
    const existing = await db.assignment.findMany({
      where: { topicId },
      select: { title: true },
      take: 20,
    });

    const model = process.env.AI_MODEL_GRADE || "claude-opus-5";
    const effort = (process.env.AI_EFFORT || "medium") as "low" | "medium" | "high";
    const started = Date.now();
    const client = new Anthropic({ apiKey, maxRetries: 1 });

    const response = await client.messages.parse({
      model,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort, format: zodOutputFormat(AssignmentSchema) },
      messages: [
        {
          role: "user",
          content: `Mavzu: ${topic.name} (modul: ${topic.module.name})
Tavsif: ${topic.description ?? "-"}
Kerakli qiyinlik: ${difficulty}/5

Shu mavzu bo'yicha bitta mashq vazifasi yarat.

${
  existing.length > 0
    ? `Mavjud vazifalar (TAKRORLAMA):\n${existing.map((e) => `- ${e.title}`).join("\n")}`
    : ""
}`,
        },
      ],
    });

    const usage = response.usage;
    await logUsage(
      "generate_assignment",
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

    const gen = response.parsed_output;
    if (!gen) return { ok: false, error: "AI javobini o'qib bo'lmadi." };
    if (gen.testCases.length < 2) {
      return { ok: false, error: "AI yetarli test-case bermadi." };
    }

    // ---- SANDBOX VALIDATSIYASI ----
    const { outcomes, infraError } = await runTestCases(
      "python",
      gen.solutionCode,
      gen.testCases.map((tc, i) => ({
        id: String(i),
        stdin: tc.stdin,
        expectedStdout: tc.expectedStdout,
        points: 1,
        order: i,
      }))
    );

    if (infraError) {
      return { ok: false, error: `Sandbox ishlamadi: ${infraError}` };
    }

    const failed = outcomes.filter((o) => !o.passed);
    if (failed.length > 0) {
      const f = failed[0];
      const tc = gen.testCases[Number(f.testCaseId)];
      console.warn(
        `[ai] vazifa rad etildi "${gen.title}": test ${Number(f.testCaseId) + 1} ` +
          `kutilgan "${tc.expectedStdout.trim()}", olingan "${f.actualOutput.trim()}"`
      );
      return {
        ok: false,
        error: `AI yechimi o'z testlaridan o'tmadi (${failed.length}/${gen.testCases.length}). Vazifa bekor qilindi.`,
      };
    }

    // ---- Saqlash: o'qituvchi tasdiqlashini kutadi ----
    const assignment = await db.assignment.create({
      data: {
        title: gen.title,
        description: gen.description,
        type: "CODE",
        language: "python",
        topicId,
        difficulty,
        starterCode: gen.starterCode,
        solutionCode: gen.solutionCode,
        maxPoints: 100,
        source: "AI_PRACTICE",
        status: "PENDING_REVIEW",
        createdById,
        testCases: {
          create: gen.testCases.map((tc, i) => ({
            stdin: tc.stdin,
            expectedStdout: tc.expectedStdout,
            isHidden: tc.isHidden,
            points: 1,
            order: i,
          })),
        },
      },
      select: { id: true, title: true },
    });

    return { ok: true, assignmentId: assignment.id, title: assignment.title };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logFailure("generate_assignment", "anthropic", "-", msg.slice(0, 100)).catch(
      () => {}
    );
    return { ok: false, error: msg.slice(0, 200) };
  }
}
