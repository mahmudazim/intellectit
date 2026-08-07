import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Role } from "@/generated/prisma/enums";

export type SessionUser = {
  id: string;
  role: Role;
  fullName: string;
  mustChangePw: boolean;
};

/** Kirgan foydalanuvchini qaytaradi, aks holda /login ga yuboradi. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user as SessionUser;
}

/** Faqat o'qituvchi. O'quvchi kelsa o'z paneliga qaytariladi. */
export async function requireTeacher(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "TEACHER") redirect("/dashboard");
  return user;
}

/** Faqat o'quvchi. O'qituvchi kelsa o'z paneliga qaytariladi. */
export async function requireStudent(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "STUDENT") redirect("/dashboard/teacher");
  return user;
}

/** API route'lar uchun: redirect emas, null qaytaradi. */
export async function getApiUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser | undefined) ?? null;
}
