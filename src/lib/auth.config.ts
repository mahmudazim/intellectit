import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

/** authorize() qaytaradigan shakl — AdapterUser bilan birlashganda tip yo'qoladi. */
type AppUser = {
  id: string;
  role: Role;
  fullName: string;
  mustChangePw: boolean;
};

/**
 * Edge-xavfsiz konfiguratsiya: middleware shu faylni ishlatadi.
 * Bu yerda bcrypt yoki Prisma CHAQIRILMAYDI — ular Edge runtime'da ishlamaydi.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30, // 30 kun — o'quvchi har safar parol kiritmasin
  },
  providers: [], // haqiqiy provayder auth.ts da qo'shiladi (Node runtime)
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as unknown as AppUser;
        token.id = u.id;
        token.role = u.role;
        token.fullName = u.fullName;
        token.mustChangePw = u.mustChangePw;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        const t = token as unknown as Partial<AppUser>;
        session.user.id = t.id ?? session.user.id;
        session.user.role = t.role ?? "STUDENT";
        session.user.fullName = t.fullName ?? session.user.name ?? "";
        session.user.mustChangePw = t.mustChangePw ?? false;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
