"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireStudent } from "@/lib/guards";
import type { ActionState } from "@/lib/actions-util";

/**
 * Telegram'ni ulash uchun bir martalik havola yaratadi.
 * Token 15 daqiqa amal qiladi.
 */
export async function createLinkTokenAction(
  _prev: ActionState<{ url: string }>,
  _formData: FormData
): Promise<ActionState<{ url: string }>> {
  const user = await requireStudent();

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return { error: "Telegram bot hali sozlanmagan. O'qituvchiga ayting." };
  }

  // Eski ishlatilmagan tokenlarni tozalaymiz
  await db.telegramLinkToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const token = randomBytes(16).toString("hex");
  await db.telegramLinkToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  return {
    ok: true,
    data: { url: `https://t.me/${botUsername}?start=${token}` },
  };
}

export async function unlinkTelegramAction(): Promise<void> {
  const user = await requireStudent();
  await db.user.update({
    where: { id: user.id },
    data: { telegramId: null, telegramUser: null },
  });
  revalidatePath("/profile");
}

export async function updateNotificationPrefAction(
  formData: FormData
): Promise<void> {
  const user = await requireStudent();

  await db.notificationPref.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      telegramOn: formData.get("telegramOn") === "on",
      newAssignment: formData.get("newAssignment") === "on",
      gradeReady: formData.get("gradeReady") === "on",
      dueReminder: formData.get("dueReminder") === "on",
      streakWarning: formData.get("streakWarning") === "on",
    },
    update: {
      telegramOn: formData.get("telegramOn") === "on",
      newAssignment: formData.get("newAssignment") === "on",
      gradeReady: formData.get("gradeReady") === "on",
      dueReminder: formData.get("dueReminder") === "on",
      streakWarning: formData.get("streakWarning") === "on",
    },
  });
  revalidatePath("/profile");
}
