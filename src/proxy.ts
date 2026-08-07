import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const TEACHER_PREFIXES = [
  "/dashboard/teacher",
  "/students",
  "/groups",
  "/topics",
  "/manage",
  "/review-queue",
  "/reports",
];

export default auth((req) => {
  const { nextUrl } = req;
  const user = req.auth?.user;
  const path = nextUrl.pathname;

  // Kirmagan foydalanuvchi
  if (!user) {
    const login = new URL("/login", nextUrl);
    if (path !== "/") login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  // Birinchi kirishda parolni almashtirish majburiy
  if (user.mustChangePw && path !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", nextUrl));
  }

  // O'qituvchi bo'limlariga o'quvchi kira olmaydi
  const isTeacherArea = TEACHER_PREFIXES.some((p) => path.startsWith(p));
  if (isTeacherArea && user.role !== "TEACHER") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Himoyalanmagan yo'llar: login, auth API, telegram webhook, cron, statik fayllar.
  // Next 16 da bu fayl "proxy" konvensiyasi (avvalgi "middleware").
  matcher: [
    "/((?!login|change-password|api/auth|api/telegram|api/cron|miniapp|_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js|workbox-).*)",
  ],
};
