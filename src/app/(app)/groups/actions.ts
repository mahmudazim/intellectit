"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import { zodToState, type ActionState } from "@/lib/actions-util";

const createSchema = z.object({
  name: z.string().trim().min(2, "Guruh nomi juda qisqa.").max(64),
  kind: z.enum(["SCHOOL_CLASS", "CLUB"]),
  note: z.string().trim().max(200).optional(),
});

export async function createGroupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireTeacher();

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return zodToState(parsed.error);

  const exists = await db.group.findFirst({
    where: { name: parsed.data.name },
  });
  if (exists) {
    return { error: "Bu nomdagi guruh allaqachon bor." };
  }

  await db.group.create({ data: parsed.data });
  revalidatePath("/groups");
  return { ok: true };
}

export async function renameGroupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireTeacher();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || name.length < 2) return { error: "Nom juda qisqa." };

  await db.group.update({ where: { id }, data: { name } });
  revalidatePath("/groups");
  return { ok: true };
}

export async function archiveGroupAction(formData: FormData): Promise<void> {
  await requireTeacher();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // O'chirmaymiz — tarixiy ma'lumot (javoblar, ballar) saqlanib qolishi kerak.
  await db.group.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/groups");
}

export async function restoreGroupAction(formData: FormData): Promise<void> {
  await requireTeacher();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.group.update({ where: { id }, data: { isActive: true } });
  revalidatePath("/groups");
}
