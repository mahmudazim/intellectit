import { createHmac } from "node:crypto";

/**
 * Telegram Mini App `initData` ni tekshirish.
 *
 * Telegram Mini App ochilganda `window.Telegram.WebApp.initData` beradi —
 * bu imzolangan qator. Uni TEKSHIRMASDAN ishonish mumkin emas: xohlagan
 * odam o'z ID sini yozib, boshqa o'quvchi sifatida kirishi mumkin.
 *
 * Algoritm (Telegram hujjatidan):
 *   secret = HMAC-SHA256(key="WebAppData", data=bot_token)
 *   hash   = HMAC-SHA256(key=secret, data=data_check_string)
 */

export type TelegramInitUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type VerifyResult =
  | { ok: true; user: TelegramInitUser; authDate: Date }
  | { ok: false; reason: string };

/** initData 24 soatdan eski bo'lmasligi kerak */
const MAX_AGE_SECONDS = 24 * 3600;

export function verifyInitData(initData: string): VerifyResult {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, reason: "Bot sozlanmagan." };
  if (!initData) return { ok: false, reason: "initData bo'sh." };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "hash yo'q." };

  // data_check_string: hash'dan tashqari barcha maydonlar,
  // alifbo tartibida, "\n" bilan birlashtirilgan
  const pairs: string[] = [];
  for (const [key, value] of [...params.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  const dataCheckString = pairs.join("\n");

  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const computed = createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");

  if (computed !== hash) {
    return { ok: false, reason: "Imzo mos kelmadi." };
  }

  const authDateRaw = params.get("auth_date");
  const authDate = authDateRaw ? new Date(Number(authDateRaw) * 1000) : null;
  if (!authDate || Number.isNaN(authDate.getTime())) {
    return { ok: false, reason: "auth_date noto'g'ri." };
  }

  const ageSeconds = (Date.now() - authDate.getTime()) / 1000;
  if (ageSeconds > MAX_AGE_SECONDS) {
    return { ok: false, reason: "initData eskirgan." };
  }

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false, reason: "user yo'q." };

  try {
    const user = JSON.parse(userRaw) as TelegramInitUser;
    if (typeof user?.id !== "number") {
      return { ok: false, reason: "user.id noto'g'ri." };
    }
    return { ok: true, user, authDate };
  } catch {
    return { ok: false, reason: "user JSON buzuq." };
  }
}
