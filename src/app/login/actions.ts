"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "/");
  const next = nextRaw.startsWith("/") ? nextRaw : "/";

  if (!username || !password) {
    return { error: "Login va parolni kiriting." };
  }

  try {
    // `redirect: false` MUHIM: bunda signIn xatoni tashlaydi va biz uni
    // ushlab, foydalanuvchiga xabar ko'rsata olamiz. Aks holda (redirectTo
    // bilan) Auth.js v5 xatoni jim yutib yuboradi va o'quvchi noto'g'ri
    // parol kiritganda hech qanday xabar ko'rmaydi.
    await signIn("credentials", { username, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin" || error.type === "CallbackRouteError") {
        return { error: "Login yoki parol noto'g'ri." };
      }
      return { error: "Kirishda xatolik yuz berdi. Qayta urinib ko'ring." };
    }
    throw error;
  }

  // redirect() maxsus xato tashlaydi — u try/catch ICHIDA bo'lmasligi kerak,
  // aks holda "kirishda xatolik" deb noto'g'ri ushlab qolinadi.
  redirect(next);
}
