"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import { generateQuestionsForTopic } from "@/lib/ai/generateQuiz";
import type { ActionState } from "@/lib/actions-util";

export async function generateQuestionsAction(
  _prev: ActionState<{ created: number; rejected: number }>,
  formData: FormData
): Promise<ActionState<{ created: number; rejected: number }>> {
  await requireTeacher();

  const topicId = String(formData.get("topicId") ?? "");
  const count = Math.min(10, Math.max(1, Number(formData.get("count") ?? 5)));
  if (!topicId) return { error: "Mavzuni tanlang." };

  const result = await generateQuestionsForTopic(topicId, count);
  if (!result.ok) return { error: result.error };

  revalidatePath("/manage/quizzes");
  revalidatePath("/review-queue");
  return {
    ok: true,
    data: { created: result.created, rejected: result.rejected },
  };
}

export async function approveQuestionAction(formData: FormData): Promise<void> {
  await requireTeacher();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.question.update({ where: { id }, data: { isApproved: true } });
  revalidatePath("/review-queue");
  revalidatePath("/manage/quizzes");
}

export async function rejectQuestionAction(formData: FormData): Promise<void> {
  await requireTeacher();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const used = await db.quizItem.count({ where: { questionId: id } });
  if (used === 0) await db.question.delete({ where: { id } });

  revalidatePath("/review-queue");
}
