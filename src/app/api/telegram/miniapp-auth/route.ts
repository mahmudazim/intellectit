import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { signIn } from "@/lib/auth";
import { verifyInitData } from "@/lib/telegram/verifyInitData";

export const runtime = "nodejs";

/**
 * Mini App autentifikatsiyasi.
 *
 * Telegram ichida ochilganda parol so'ralmaydi — `initData` imzosi
 * tekshiriladi va shu Telegram ID ga bog'langan o'quvchi topiladi.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const initData = typeof body?.initData === "string" ? body.initData : "";

  const check = verifyInitData(initData);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { telegramId: BigInt(check.user.id) },
    select: { id: true, username: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return NextResponse.json(
      {
        error:
          "Bu Telegram akkaunt platformaga ulanmagan. Avval saytga kirib, Profil → Telegram'ni ulash qiling.",
      },
      { status: 404 }
    );
  }

  // Credentials provider parolsiz kirishga ruxsat bermaydi, shuning uchun
  // Mini App uchun alohida provayder kerak bo'lardi. Soddaroq yo'l:
  // bir martalik token yaratib, uni login sahifasiga uzatamiz.
  const { randomBytes } = await import("node:crypto");
  const token = randomBytes(24).toString("hex");

  await db.telegramLinkToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });
  await db.telegramLinkToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000),
    },
  });

  return NextResponse.json({ ok: true, token });
}
