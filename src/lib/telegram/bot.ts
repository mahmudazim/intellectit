import { Bot, InlineKeyboard } from "grammy";

import { db } from "@/lib/db";
import { levelFromXp, totalXp, weeklyXp } from "@/lib/gamification/xp";
import { getStudentAssignments } from "@/lib/assignments";
import { esc } from "./notify";

/**
 * Telegram bot — o'quvchi platformaga kirmasdan asosiy ma'lumotni
 * ko'ra oladi va bildirishnoma oladi.
 *
 * Bot faqat webhook orqali ishlaydi (polling emas) — Vercel'da
 * doimiy ishlaydigan jarayon yo'q.
 */

let bot: Bot | null = null;

function appUrl(path = ""): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${path}`;
}

/** Telegram ID bo'yicha o'quvchini topadi. */
async function findUser(telegramId: bigint) {
  return db.user.findUnique({
    where: { telegramId },
    select: { id: true, fullName: true, role: true, isActive: true },
  });
}

const NOT_LINKED =
  "Akkauntingiz hali ulanmagan.\n\n" +
  "Ulash uchun: platformaga kiring → <b>Profil</b> → <b>Telegram'ni ulash</b>. " +
  "Sizga havola beriladi, uni bosing.";

export function getBot(): Bot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  if (bot) return bot;

  bot = new Bot(token);

  // ---------- /start ----------
  bot.command("start", async (ctx) => {
    const payload = ctx.match?.trim();
    const tgId = BigInt(ctx.from!.id);

    // Ulanish tokeni bilan kelgan
    if (payload) {
      const token = await db.telegramLinkToken.findUnique({
        where: { token: payload },
        select: { id: true, userId: true, expiresAt: true, usedAt: true },
      });

      if (!token || token.usedAt || token.expiresAt < new Date()) {
        await ctx.reply(
          "Havola eskirgan yoki allaqachon ishlatilgan. Platformadan yangi havola oling."
        );
        return;
      }

      // Bu Telegram allaqachon boshqa akkauntga ulanganmi?
      const existing = await db.user.findUnique({
        where: { telegramId: tgId },
        select: { id: true },
      });
      if (existing && existing.id !== token.userId) {
        await db.user.update({
          where: { id: existing.id },
          data: { telegramId: null, telegramUser: null },
        });
      }

      const user = await db.user.update({
        where: { id: token.userId },
        data: {
          telegramId: tgId,
          telegramUser: ctx.from?.username ?? null,
        },
        select: { fullName: true },
      });
      await db.telegramLinkToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      });

      await ctx.reply(
        `✅ Ulandi!\n\nSalom, <b>${esc(user.fullName)}</b>.\n\n` +
          `Endi yangi vazifa, baho va muddat haqida shu yerda xabar olasiz.\n\n` +
          `Buyruqlar:\n` +
          `/vazifalar — bajarilmagan vazifalar\n` +
          `/natija — oxirgi natijalar\n` +
          `/reyting — guruh reytingi\n` +
          `/streak — XP va streak`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const user = await findUser(tgId);
    if (!user) {
      await ctx.reply(NOT_LINKED, { parse_mode: "HTML" });
      return;
    }

    const kb = appUrl()
      ? new InlineKeyboard().url("Platformani ochish", appUrl("/dashboard"))
      : undefined;

    await ctx.reply(
      `Salom, <b>${esc(user.fullName)}</b>!\n\n` +
        `/vazifalar — bajarilmagan vazifalar\n` +
        `/natija — oxirgi natijalar\n` +
        `/reyting — guruh reytingi\n` +
        `/streak — XP va streak`,
      { parse_mode: "HTML", reply_markup: kb }
    );
  });

  // ---------- /vazifalar ----------
  bot.command("vazifalar", async (ctx) => {
    const user = await findUser(BigInt(ctx.from!.id));
    if (!user) return ctx.reply(NOT_LINKED, { parse_mode: "HTML" });

    const all = await getStudentAssignments(user.id);
    const pending = all.filter(
      (a) => !a.submission || a.submission.status !== "GRADED"
    );

    if (pending.length === 0) {
      return ctx.reply("🎉 Barcha vazifalar bajarilgan!");
    }

    const lines = pending.slice(0, 8).map((a) => {
      const due = a.dueAt
        ? new Intl.DateTimeFormat("uz-UZ", {
            day: "numeric",
            month: "short",
            timeZone: "Asia/Tashkent",
          }).format(a.dueAt)
        : null;
      return (
        `• <b>${esc(a.title)}</b>\n  ${esc(a.topic.name)}` +
        (due ? ` · ⏰ ${due}` : "") +
        (a.reason ? `\n  🎯 ${esc(a.reason)}` : "")
      );
    });

    const kb = appUrl()
      ? new InlineKeyboard().url("Ochish", appUrl("/assignments"))
      : undefined;

    await ctx.reply(
      `📘 <b>Bajarilmagan vazifalar (${pending.length})</b>\n\n${lines.join("\n\n")}`,
      { parse_mode: "HTML", reply_markup: kb }
    );
  });

  // ---------- /natija ----------
  bot.command("natija", async (ctx) => {
    const user = await findUser(BigInt(ctx.from!.id));
    if (!user) return ctx.reply(NOT_LINKED, { parse_mode: "HTML" });

    const subs = await db.submission.findMany({
      where: { studentId: user.id, status: "GRADED" },
      orderBy: { gradedAt: "desc" },
      take: 5,
      select: {
        finalScore: true,
        testsPassed: true,
        testsTotal: true,
        assignment: { select: { title: true } },
      },
    });

    if (subs.length === 0) {
      return ctx.reply("Hali baholangan javob yo'q.");
    }

    const lines = subs.map((s) => {
      const score = s.finalScore ?? 0;
      const emoji = score >= 80 ? "✅" : score >= 50 ? "📝" : "🔄";
      return `${emoji} <b>${score}</b> — ${esc(s.assignment.title)} (${s.testsPassed}/${s.testsTotal})`;
    });

    await ctx.reply(`📊 <b>Oxirgi natijalar</b>\n\n${lines.join("\n")}`, {
      parse_mode: "HTML",
    });
  });

  // ---------- /streak ----------
  bot.command("streak", async (ctx) => {
    const user = await findUser(BigInt(ctx.from!.id));
    if (!user) return ctx.reply(NOT_LINKED, { parse_mode: "HTML" });

    const [xp, week, streak, badges] = await Promise.all([
      totalXp(user.id),
      weeklyXp(user.id),
      db.streak.findUnique({ where: { userId: user.id } }),
      db.userBadge.count({ where: { userId: user.id } }),
    ]);

    await ctx.reply(
      `⚡ <b>${xp} XP</b> · ${levelFromXp(xp)}-daraja\n` +
        `🔥 Streak: <b>${streak?.current ?? 0}</b> kun (eng uzun ${streak?.longest ?? 0})\n` +
        `🏅 Nishonlar: <b>${badges}</b>\n` +
        `📈 Bu hafta: <b>${week} XP</b>`,
      { parse_mode: "HTML" }
    );
  });

  // ---------- /reyting ----------
  bot.command("reyting", async (ctx) => {
    const user = await findUser(BigInt(ctx.from!.id));
    if (!user) return ctx.reply(NOT_LINKED, { parse_mode: "HTML" });

    const membership = await db.groupMember.findFirst({
      where: { userId: user.id },
      select: { groupId: true, group: { select: { name: true } } },
    });

    const peers = await db.user.findMany({
      where: {
        role: "STUDENT",
        isActive: true,
        ...(membership ? { groups: { some: { groupId: membership.groupId } } } : {}),
      },
      select: { id: true, fullName: true },
    });

    const since = new Date();
    since.setDate(since.getDate() - 7);
    const rows = await db.xpEvent.groupBy({
      by: ["userId"],
      where: { userId: { in: peers.map((p) => p.id) }, createdAt: { gte: since } },
      _sum: { amount: true },
    });
    const xpBy = new Map(rows.map((r) => [r.userId, r._sum.amount ?? 0]));

    const ranked = peers
      .map((p) => ({ ...p, xp: xpBy.get(p.id) ?? 0 }))
      .sort((a, b) => b.xp - a.xp);

    const myIndex = ranked.findIndex((r) => r.id === user.id);
    const medals = ["🥇", "🥈", "🥉"];

    const lines = ranked
      .slice(0, 5)
      .map(
        (r, i) =>
          `${medals[i] ?? `${i + 1}.`} ${esc(r.fullName)}${r.id === user.id ? " (siz)" : ""} — <b>${r.xp}</b>`
      );

    const mine =
      myIndex >= 5 ? `\n\n... \n${myIndex + 1}. Siz — <b>${ranked[myIndex].xp}</b>` : "";

    await ctx.reply(
      `🏆 <b>${esc(membership?.group.name ?? "Reyting")}</b> (shu hafta)\n\n${lines.join("\n")}${mine}`,
      { parse_mode: "HTML" }
    );
  });

  // ---------- /yordam ----------
  bot.command("yordam", async (ctx) => {
    await ctx.reply(
      `<b>Buyruqlar</b>\n\n` +
        `/vazifalar — bajarilmagan vazifalar\n` +
        `/natija — oxirgi 5 ta natija\n` +
        `/reyting — guruh reytingi\n` +
        `/streak — XP, daraja va streak\n\n` +
        `Kod yozish va vazifa topshirish uchun platformani oching.`,
      { parse_mode: "HTML" }
    );
  });

  // Noma'lum matn
  bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) {
      await ctx.reply("Bunday buyruq yo'q. /yordam ni yozing.");
    }
  });

  bot.catch((err) => {
    console.error("[telegram] bot xatosi:", err.message);
  });

  return bot;
}
