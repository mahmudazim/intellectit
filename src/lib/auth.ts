import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";

const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(6).max(128),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "username",
      credentials: {
        username: { label: "Login", type: "text" },
        password: { label: "Parol", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const username = parsed.data.username.toLowerCase();
        const user = await db.user.findUnique({ where: { username } });

        // Vaqt hujumidan (timing attack) himoya: foydalanuvchi topilmasa ham
        // bcrypt taqqoslash bajariladi, shunda javob vaqti bir xil bo'ladi.
        const hash =
          user?.passwordHash ??
          "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";
        const ok = await bcrypt.compare(parsed.data.password, hash);

        if (!user || !user.isActive || !user.passwordHash || !ok) return null;

        await db.user.update({
          where: { id: user.id },
          data: { lastSeenAt: new Date() },
        });

        return {
          id: user.id,
          name: user.fullName,
          fullName: user.fullName,
          role: user.role,
          mustChangePw: user.mustChangePw,
        };
      },
    }),

    /**
     * Telegram Mini App uchun parolsiz kirish.
     *
     * Token `/api/telegram/miniapp-auth` da yaratiladi — u yerda
     * Telegram `initData` imzosi HMAC bilan tekshirilgan. Bu yerda
     * faqat bir martalik tokenni tekshiramiz.
     */
    Credentials({
      id: "telegram",
      name: "telegram",
      credentials: { token: { label: "Token", type: "text" } },
      async authorize(raw) {
        const token = String((raw as { token?: string })?.token ?? "");
        if (token.length < 32) return null;

        const record = await db.telegramLinkToken.findUnique({
          where: { token },
          select: {
            id: true,
            usedAt: true,
            expiresAt: true,
            user: {
              select: {
                id: true,
                fullName: true,
                role: true,
                isActive: true,
                mustChangePw: true,
              },
            },
          },
        });

        if (!record || record.usedAt || record.expiresAt < new Date()) {
          return null;
        }
        if (!record.user.isActive) return null;

        // Token bir martalik — darhol ishlatilgan deb belgilaymiz
        await db.telegramLinkToken.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        });
        await db.user.update({
          where: { id: record.user.id },
          data: { lastSeenAt: new Date() },
        });

        return {
          id: record.user.id,
          name: record.user.fullName,
          fullName: record.user.fullName,
          role: record.user.role,
          // Telegram orqali kirganda parol almashtirish talab qilinmaydi
          mustChangePw: false,
        };
      },
    }),
  ],
});
