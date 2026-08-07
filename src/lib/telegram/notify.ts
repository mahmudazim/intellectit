import { db } from "@/lib/db";

/**
 * Telegram bildirishnomalari.
 *
 * Bot API'ga to'g'ridan-to'g'ri fetch bilan murojaat qilamiz — bitta
 * xabar yuborish uchun butun grammY ni yuklash shart emas (webhook'da
 * grammY ishlatiladi).
 *
 * Barcha funksiyalar "jim" ishlaydi: Telegram ishlamasa ham platforma
 * to'xtamasligi kerak.
 */

const API = "https://api.telegram.org";

type NotificationKind =
  | "newAssignment"
  | "gradeReady"
  | "dueReminder"
  | "streakWarning"
  | "weeklyReport";

/** Toshkent vaqti bo'yicha hozirgi soat. */
function tashkentHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tashkent",
      hour: "2-digit",
      hour12: false,
    }).format(new Date())
  );
}

async function sendRaw(
  chatId: string | bigint,
  text: string,
  replyMarkup?: unknown
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  try {
    const res = await fetch(`${API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: String(chatId),
        text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // 403 — foydalanuvchi botni bloklagan. Bu xato emas, holat.
      if (res.status === 403) {
        console.warn(`[telegram] ${chatId} botni bloklagan`);
      } else {
        console.error(`[telegram] ${res.status}: ${body.slice(0, 200)}`);
      }
      return false;
    }
    return true;
  } catch (e) {
    console.error("[telegram] yuborishda xato:", e);
    return false;
  }
}

/**
 * Foydalanuvchiga xabar yuboradi — sozlamalari va "jim soatlar"ni
 * hisobga olgan holda.
 */
export async function notify(
  userId: string,
  kind: NotificationKind,
  text: string,
  buttonUrl?: { label: string; path: string }
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      telegramId: true,
      notificationPref: true,
    },
  });

  if (!user?.telegramId) return false;

  const pref = user.notificationPref;
  if (!pref?.telegramOn) return false;
  if (pref[kind] === false) return false;

  // Jim soatlar — kechasi o'quvchini uyg'otmaymiz.
  // Muhim: bu xabar butunlay tashlab yuboriladi, ertaga navbatga qo'yilmaydi
  // (eskirgan xabar foydasiz).
  const hour = tashkentHour();
  const { quietFrom, quietTo } = pref;
  const inQuiet =
    quietFrom > quietTo
      ? hour >= quietFrom || hour < quietTo // masalan 22:00–07:00
      : hour >= quietFrom && hour < quietTo;

  if (inQuiet && kind !== "gradeReady") return false;

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const markup =
    buttonUrl && base
      ? {
          inline_keyboard: [
            [{ text: buttonUrl.label, url: `${base}${buttonUrl.path}` }],
          ],
        }
      : undefined;

  return sendRaw(user.telegramId, text, markup);
}

/** HTML maxsus belgilarini xavfsizlaydi. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ============================================================
// Tayyor xabarlar
// ============================================================

export async function notifyNewAssignment(
  userId: string,
  title: string,
  assignmentId: string,
  dueAt: Date | null,
  reason?: string | null
) {
  const due = dueAt
    ? new Intl.DateTimeFormat("uz-UZ", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tashkent",
      }).format(dueAt)
    : null;

  const text =
    `📘 <b>Yangi vazifa</b>\n${esc(title)}` +
    (reason ? `\n🎯 ${esc(reason)}` : "") +
    (due ? `\n⏰ Muddat: ${due}` : "");

  return notify(userId, "newAssignment", text, {
    label: "Vazifani ochish",
    path: `/assignments/${assignmentId}`,
  });
}

export async function notifyGradeReady(
  userId: string,
  title: string,
  assignmentId: string,
  score: number,
  passed: number,
  total: number,
  summary?: string | null
) {
  const emoji = score >= 80 ? "✅" : score >= 50 ? "📝" : "🔄";
  const text =
    `${emoji} <b>${esc(title)}</b>\n` +
    `Ball: <b>${score}</b> · ${passed}/${total} test` +
    (summary ? `\n\n${esc(summary)}` : "");

  return notify(userId, "gradeReady", text, {
    label: "Batafsil ko'rish",
    path: `/assignments/${assignmentId}`,
  });
}

export async function notifyDueReminder(
  userId: string,
  title: string,
  assignmentId: string,
  hoursLeft: number
) {
  const text =
    `⏰ <b>Muddat yaqinlashmoqda</b>\n${esc(title)}\n` +
    `${hoursLeft} soat qoldi`;

  return notify(userId, "dueReminder", text, {
    label: "Bajarish",
    path: `/assignments/${assignmentId}`,
  });
}

export async function notifyStreakWarning(userId: string, current: number) {
  const text =
    `🔥 <b>${current} kunlik streak xavf ostida!</b>\n` +
    `Bugun hali mashq qilmadingiz. Bitta vazifa yetadi.`;

  return notify(userId, "streakWarning", text, {
    label: "Mashq qilish",
    path: "/assignments",
  });
}

export async function notifyBadge(userId: string, badgeName: string) {
  const text = `🏅 <b>Yangi nishon!</b>\n${esc(badgeName)}`;
  return notify(userId, "gradeReady", text, {
    label: "Profilni ko'rish",
    path: "/profile",
  });
}

/** O'qituvchiga xabar — kunlik xulosa, ogohlantirishlar. */
export async function notifyTeacher(text: string): Promise<boolean> {
  const teacher = await db.user.findFirst({
    where: { role: "TEACHER", telegramId: { not: null } },
    select: { id: true },
  });
  if (!teacher) return false;
  return notify(teacher.id, "weeklyReport", text);
}
