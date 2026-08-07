"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import {
  generatePassword,
  zodToState,
  type ActionState,
} from "@/lib/actions-util";

const createSchema = z.object({
  fullName: z.string().trim().min(3, "To'liq ismni yozing.").max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Login kamida 3 ta belgi.")
    .max(32)
    .regex(/^[a-z0-9._-]+$/, "Faqat lotin harflari, raqam, nuqta va chiziqcha."),
  groupId: z.string().optional(),
});

export type CreatedStudent = { fullName: string; username: string; password: string };

export async function createStudentAction(
  _prev: ActionState<CreatedStudent>,
  formData: FormData
): Promise<ActionState<CreatedStudent>> {
  await requireTeacher();

  const parsed = createSchema.safeParse({
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    groupId: formData.get("groupId") || undefined,
  });
  if (!parsed.success) return zodToState(parsed.error);

  const { fullName, username, groupId } = parsed.data;

  const exists = await db.user.findUnique({ where: { username } });
  if (exists) {
    return {
      error: "Bu login band. Boshqasini tanlang (masalan oxiriga raqam qo'shing).",
      fieldErrors: { username: "Band" },
    };
  }

  // Parol faqat SHU YERDA ochiq ko'rinadi — bazaga hash saqlanadi.
  const password = generatePassword();

  await db.user.create({
    data: {
      fullName,
      username,
      role: "STUDENT",
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePw: true,
      notificationPref: { create: {} },
      streak: { create: {} },
      ...(groupId ? { groups: { create: { groupId } } } : {}),
    },
  });

  revalidatePath("/students");
  revalidatePath("/groups");
  return { ok: true, data: { fullName, username, password } };
}

export async function resetPasswordAction(
  _prev: ActionState<CreatedStudent>,
  formData: FormData
): Promise<ActionState<CreatedStudent>> {
  await requireTeacher();

  const id = String(formData.get("id") ?? "");
  const student = await db.user.findFirst({
    where: { id, role: "STUDENT" },
  });
  if (!student) return { error: "O'quvchi topilmadi." };

  const password = generatePassword();
  await db.user.update({
    where: { id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePw: true,
    },
  });

  revalidatePath("/students");
  return {
    ok: true,
    data: { fullName: student.fullName, username: student.username, password },
  };
}

export async function toggleStudentActiveAction(
  formData: FormData
): Promise<void> {
  await requireTeacher();
  const id = String(formData.get("id") ?? "");
  const student = await db.user.findFirst({ where: { id, role: "STUDENT" } });
  if (!student) return;

  await db.user.update({
    where: { id },
    data: { isActive: !student.isActive },
  });
  revalidatePath("/students");
}

export async function setStudentGroupAction(formData: FormData): Promise<void> {
  await requireTeacher();
  const userId = String(formData.get("userId") ?? "");
  const groupId = String(formData.get("groupId") ?? "");
  if (!userId) return;

  // Bitta o'quvchi bitta guruhda (sodda model). Avvalgisini olib tashlaymiz.
  await db.groupMember.deleteMany({ where: { userId } });
  if (groupId) {
    await db.groupMember.create({ data: { userId, groupId } });
  }
  revalidatePath("/students");
  revalidatePath("/groups");
}
