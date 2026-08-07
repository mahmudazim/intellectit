"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Parol kamida 8 ta belgidan iborat bo'lsin.")
      .max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Parollar mos kelmadi.",
    path: ["confirm"],
  });

export type ChangePwState = { error?: string; done?: boolean };

export async function changePasswordAction(
  _prev: ChangePwState,
  formData: FormData
): Promise<ChangePwState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const parsed = schema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Parol noto'g'ri." };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      mustChangePw: false,
    },
  });

  // JWT ichidagi mustChangePw eskirgan — sessiyani yangilash uchun qayta kiritamiz.
  await signOut({ redirectTo: "/login?parol=ozgartirildi" });
  return { done: true };
}
