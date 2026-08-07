import type { GradeInput } from "../types";

/**
 * Prompt uch qismga bo'linadi:
 *  1. BASE_RUBRIC        — hech qachon o'zgarmaydi (keshlanadi)
 *  2. buildTaskContext   — bitta vazifa uchun bir xil (keshlanadi)
 *  3. buildStudentBlock  — har o'quvchida o'zgaradi (keshlanmaydi, OXIRIDA)
 *
 * Shu tartib tufayli bitta sinfning 25 ta javobini tekshirganda kirish
 * tokenlarining ~90% i kesh'dan o'qiladi.
 */

export function buildTaskContext(input: GradeInput): string {
  const { assignment, topicSlugs, primaryTopicSlug } = input;

  // Slug'lar ALIFBO TARTIBIDA — tartib o'zgarsa kesh buziladi
  const slugs = [...topicSlugs].sort().join(", ");

  return `## Vazifa

Sarlavha: ${assignment.title}
Til: ${assignment.language}
Qiyinlik: ${assignment.difficulty}/5
Asosiy mavzu (fallback slug): ${primaryTopicSlug}

Shart:
${assignment.description}
${assignment.rubric ? `\nO'qituvchining qo'shimcha mezoni:\n${assignment.rubric}` : ""}

## Mavjud mavzu slug'lari

${slugs}`;
}

export function buildStudentBlock(input: GradeInput): string {
  const { testSummary, studentCode } = input;

  const failures = testSummary.failures
    .slice(0, 4)
    .map(
      (f, i) =>
        `Test ${i + 1}: kutilgan ${JSON.stringify(f.expected.trim())}, ` +
        `olingan ${JSON.stringify(f.actual.trim())}` +
        (f.stderr ? `\n  xato: ${f.stderr.split("\n").slice(-2).join(" ")}` : "")
    )
    .join("\n");

  return `## Avtomatik test natijasi

${testSummary.passed} / ${testSummary.total} test o'tdi.
${failures ? `\nO'tmagan testlar:\n${failures}` : "Barcha testlar o'tdi."}

## O'quvchi kodi

<student_code>
${studentCode}
</student_code>

Yuqoridagi qoidalar asosida baho va izoh ber.`;
}
