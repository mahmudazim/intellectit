import { z } from "zod";

/**
 * AI baholash natijasi. Matndan parse QILINMAYDI — strukturali chiqish
 * (structured output) orqali olinadi, shuning uchun shakl kafolatlangan.
 */
export const GradeSchema = z.object({
  /** 0..100 — test natijasiga zid bo'lmasligi kerak */
  score: z.number().min(0).max(100),
  isCorrect: z.boolean(),
  /** O'zbekcha, 1-2 jumla. Telefonda birinchi shu ko'rinadi. */
  summary: z.string(),
  /** Kamida bittasi — o'quvchini rag'batlantirish uchun */
  strengths: z.array(z.string()),
  issues: z.array(
    z.object({
      /** Kod qatori raqami, aniqlab bo'lmasa null */
      line: z.number().nullable(),
      /** Mavjud Topic.slug lardan biri */
      topicSlug: z.string(),
      severity: z.enum(["critical", "major", "minor", "style"]),
      /** Nima noto'g'ri va NEGA — tayyor yechim EMAS */
      explanation: z.string(),
      /** O'quvchini to'g'ri yo'lga soluvchi savol yoki maslahat */
      hint: z.string(),
    })
  ),
  /** Kodning o'qilishi, nomlash, tuzilma: 0..100 */
  codeQuality: z.number().min(0).max(100),
  /** Keyin mustahkamlash kerak bo'lgan mavzular (Topic.slug) */
  nextTopics: z.array(z.string()),
});

export type Grade = z.infer<typeof GradeSchema>;

/**
 * AI qaytargan slug'larni mavjudlariga moslashtiradi.
 * Noma'lum slug kelsa — vazifaning asosiy mavzusiga tushiriladi.
 */
export function normalizeGrade(
  grade: Grade,
  validSlugs: string[],
  fallbackSlug: string
): Grade {
  const valid = new Set(validSlugs);
  return {
    ...grade,
    score: Math.round(Math.max(0, Math.min(100, grade.score))),
    codeQuality: Math.round(Math.max(0, Math.min(100, grade.codeQuality))),
    strengths: grade.strengths.slice(0, 3),
    issues: grade.issues.slice(0, 6).map((i) => ({
      ...i,
      topicSlug: valid.has(i.topicSlug) ? i.topicSlug : fallbackSlug,
    })),
    nextTopics: [...new Set(grade.nextTopics)]
      .filter((s) => valid.has(s))
      .slice(0, 3),
  };
}
