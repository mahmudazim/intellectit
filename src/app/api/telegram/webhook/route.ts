import { NextResponse } from "next/server";
import { webhookCallback } from "grammy";

import { getBot } from "@/lib/telegram/bot";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Telegram webhook.
 *
 * XAVFSIZLIK: Telegram `X-Telegram-Bot-Api-Secret-Token` sarlavhasini
 * yuboradi (setWebhook da o'rnatilgan). Uni tekshirmasak, xohlagan odam
 * soxta xabar yuborishi mumkin.
 */
export async function POST(request: Request) {
  const bot = getBot();
  if (!bot) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN sozlanmagan." },
      { status: 503 }
    );
  }

  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected) {
    const got = request.headers.get("x-telegram-bot-api-secret-token");
    if (got !== expected) {
      return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 401 });
    }
  }

  try {
    const handler = webhookCallback(bot, "std/http");
    return await handler(request);
  } catch (e) {
    console.error("[telegram] webhook xatosi:", e);
    // Telegram 200 olmasa qayta-qayta yuboradi — 200 qaytaramiz
    return NextResponse.json({ ok: true });
  }
}
