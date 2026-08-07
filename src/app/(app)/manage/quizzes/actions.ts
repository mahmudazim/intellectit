"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import { zodToState, type ActionState } from "@/lib/actions-util";

const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1).max(500),
  isCorrect: z.boolean(),
});

const questionSchema = z
  .object({
    topicId: z.string().min(1, "Mavzuni tanlang."),
    type: z.enum([
      "MCQ_SINGLE",
      "MCQ_MULTI",
      "TRUE_FALSE",
      "SHORT_ANSWER",
      "CODE_OUTPUT",
      "FILL_BLANK",
    ]),
    prompt: z.string().trim().min(5, "Savol matnini yozing.").max(2000),
    codeSnippet: z.string().max(4000).optional(),
    options: z.array(optionSchema).max(8),
    correctText: z.string().trim().max(500).optional(),
    explanation: z.string().trim().max(2000).default(""),
    difficulty: z.number().int().min(1).max(5),
    points: z.number().int().min(1).max(20),
  })
  .superRefine((q, ctx) => {
    const isChoice =
      q.type === "MCQ_SINGLE" || q.type === "MCQ_MULTI" || q.type === "TRUE_FALSE";

    if (isChoice) {
      if (q.options.length < 2) {
        ctx.addIssue({ code: "custom", message: "Kamida 2 ta variant kerak." });
      }
      const correct = q.options.filter((o) => o.isCorrect).length;
      if (correct === 0) {
        ctx.addIssue({ code: "custom", message: "To'g'ri javobni belgilang." });
      }
      if (q.type !== "MCQ_MULTI" && correct > 1) {
        ctx.addIssue({
          code: "custom",
          message: "Bu turda faqat bitta to'g'ri javob bo'lishi mumkin.",
        });
      }
    } else if (!q.correctText?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "To'g'ri javobni yozing (bir nechta variantni | bilan ajrating).",
      });
    }
  });

function readJson<T>(formData: FormData, key: string, fallback: T): T {
  const raw = formData.get(key);
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function createQuestionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireTeacher();

  const parsed = questionSchema.safeParse({
    topicId: formData.get("topicId"),
    type: formData.get("type"),
    prompt: formData.get("prompt"),
    codeSnippet: formData.get("codeSnippet") || undefined,
    options: readJson(formData, "options", []),
    correctText: formData.get("correctText") || undefined,
    explanation: formData.get("explanation") || "",
    difficulty: Number(formData.get("difficulty") ?? 1),
    points: Number(formData.get("points") ?? 1),
  });
  if (!parsed.success) return zodToState(parsed.error);

  const q = parsed.data;
  const isChoice =
    q.type === "MCQ_SINGLE" || q.type === "MCQ_MULTI" || q.type === "TRUE_FALSE";

  await db.question.create({
    data: {
      topicId: q.topicId,
      type: q.type,
      prompt: q.prompt,
      codeSnippet: q.codeSnippet,
      options: isChoice ? q.options : undefined,
      correctText: isChoice ? null : q.correctText,
      explanation: q.explanation,
      difficulty: q.difficulty,
      points: q.points,
      source: "TEACHER",
      isApproved: true,
    },
  });

  revalidatePath("/manage/quizzes");
  return { ok: true };
}

export async function deleteQuestionAction(formData: FormData): Promise<void> {
  await requireTeacher();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Testda ishlatilgan savol o'chirilmaydi — javoblar tarixi buziladi
  const used = await db.quizItem.count({ where: { questionId: id } });
  if (used > 0) return;

  await db.question.delete({ where: { id } });
  revalidatePath("/manage/quizzes");
}

const quizSchema = z.object({
  title: z.string().trim().min(3, "Sarlavha juda qisqa.").max(120),
  description: z.string().trim().max(1000).optional(),
  timeLimitMin: z.number().int().min(1).max(180).nullable(),
  maxAttempts: z.number().int().min(1).max(5),
  shuffle: z.boolean(),
  showAnswersAt: z.enum(["IMMEDIATELY", "AFTER_SUBMIT", "AFTER_DUE", "NEVER"]),
  questionIds: z.array(z.string()).min(1, "Kamida bitta savol tanlang."),
  groupIds: z.array(z.string()),
  studentIds: z.array(z.string()),
  dueAt: z.string().optional(),
  publish: z.boolean(),
});

export async function createQuizAction(
  _prev: ActionState<{ id: string }>,
  formData: FormData
): Promise<ActionState<{ id: string }>> {
  await requireTeacher();

  const timeRaw = formData.get("timeLimitMin");
  const parsed = quizSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    timeLimitMin: timeRaw ? Number(timeRaw) : null,
    maxAttempts: Number(formData.get("maxAttempts") ?? 1),
    shuffle: formData.get("shuffle") === "on",
    showAnswersAt: formData.get("showAnswersAt") || "AFTER_SUBMIT",
    questionIds: readJson(formData, "questionIds", [] as string[]),
    groupIds: readJson(formData, "groupIds", [] as string[]),
    studentIds: readJson(formData, "studentIds", [] as string[]),
    dueAt: formData.get("dueAt") || undefined,
    publish: formData.get("publish") === "1",
  });
  if (!parsed.success) return zodToState(parsed.error);

  const d = parsed.data;
  if (d.publish && d.groupIds.length === 0 && d.studentIds.length === 0) {
    return { error: "Testni kimga berishni tanlang." };
  }

  const quiz = await db.quiz.create({
    data: {
      title: d.title,
      description: d.description,
      timeLimitMin: d.timeLimitMin,
      maxAttempts: d.maxAttempts,
      shuffle: d.shuffle,
      showAnswersAt: d.showAnswersAt,
      status: d.publish ? "PUBLISHED" : "DRAFT",
      dueAt: d.dueAt ? new Date(d.dueAt) : null,
      targets: { groupIds: d.groupIds, userIds: d.studentIds },
      items: {
        create: d.questionIds.map((questionId, order) => ({ questionId, order })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/manage/quizzes");
  revalidatePath("/quizzes");
  return { ok: true, data: { id: quiz.id } };
}

export async function setQuizStatusAction(formData: FormData): Promise<void> {
  await requireTeacher();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) return;

  await db.quiz.update({
    where: { id },
    data: { status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED" },
  });
  revalidatePath("/manage/quizzes");
  revalidatePath("/quizzes");
}
