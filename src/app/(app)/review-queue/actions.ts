"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import { assignPracticeForAll } from "@/lib/mastery/recommend";
import type { ActionState } from "@/lib/actions-util";

/**
 * AI yaratgan vazifani tasdiqlash.
 * Tasdiqlangach PUBLISHED bo'ladi va keyingi mashq taqsimotida ishlatiladi.
 */
export async function approveAssignmentAction(formData: FormData): Promise<void> {
  await requireTeacher();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.assignment.update({
    where: { id },
    data: { status: "PUBLISHED" },
  });
  revalidatePath("/review-queue");
  revalidatePath("/manage/assignments");
}

export async function rejectAssignmentAction(formData: FormData): Promise<void> {
  await requireTeacher();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const used = await db.submission.count({ where: { assignmentId: id } });
  if (used > 0) {
    // Javob berilgan bo'lsa o'chirmaymiz — tarix saqlanadi
    await db.assignment.update({ where: { id }, data: { status: "ARCHIVED" } });
  } else {
    await db.assignment.delete({ where: { id } });
  }
  revalidatePath("/review-queue");
}

/**
 * Mashqlarni qo'lda taqsimlash (cron'ni kutmasdan).
 * O'qituvchi tugmani bosganda darhol ishlaydi.
 */
export async function runPracticeAssignmentAction(
  _prev: ActionState<{ assigned: number; students: number; generated: number }>,
  _formData: FormData
): Promise<ActionState<{ assigned: number; students: number; generated: number }>> {
  await requireTeacher();

  const { results, totalAssigned } = await assignPracticeForAll(3);
  const generated = results.reduce((n, r) => n + r.generated, 0);

  revalidatePath("/review-queue");
  revalidatePath("/assignments");

  return {
    ok: true,
    data: { assigned: totalAssigned, students: results.length, generated },
  };
}
