import { Flame, TrendingUp, Trophy } from "lucide-react";

import { db } from "@/lib/db";
import { requireStudent } from "@/lib/guards";
import { levelFromXp } from "@/lib/gamification/xp";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata = { title: "Reyting" };

/**
 * Reyting — HAFTALIK XP bo'yicha, umumiy XP emas.
 *
 * Nega: yangi kelgan o'quvchi ham birinchi bo'la oladi. Umumiy XP bo'yicha
 * bo'lsa, birinchi oydan beri yurgan o'quvchi doim yuqorida turadi va
 * yangilar hech qachon yeta olmaydi — bu rag'batlantirmaydi, aksincha.
 *
 * Pastki o'rinlar KO'RSATILMAYDI — faqat top-10 va o'quvchining o'z o'rni.
 */

async function xpSince(userIds: string[], days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db.xpEvent.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, createdAt: { gte: since } },
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.userId, r._sum.amount ?? 0]));
}

export default async function LeaderboardPage() {
  const user = await requireStudent();

  const membership = await db.groupMember.findFirst({
    where: { userId: user.id },
    select: { groupId: true, group: { select: { name: true } } },
  });

  // Reyting guruh ichida — butun maktab bo'yicha emas
  const peers = await db.user.findMany({
    where: {
      role: "STUDENT",
      isActive: true,
      ...(membership ? { groups: { some: { groupId: membership.groupId } } } : {}),
    },
    select: { id: true, fullName: true },
  });

  const ids = peers.map((p) => p.id);
  const [thisWeek, lastWeek, streaks, totals] = await Promise.all([
    xpSince(ids, 7),
    xpSince(ids, 14),
    db.streak.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, current: true },
    }),
    db.xpEvent.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _sum: { amount: true },
    }),
  ]);

  const streakMap = new Map(streaks.map((s) => [s.userId, s.current]));
  const totalMap = new Map(totals.map((t) => [t.userId, t._sum.amount ?? 0]));

  const ranked = peers
    .map((p) => {
      const week = thisWeek.get(p.id) ?? 0;
      const prev = (lastWeek.get(p.id) ?? 0) - week;
      return {
        ...p,
        weekXp: week,
        prevWeekXp: prev,
        totalXp: totalMap.get(p.id) ?? 0,
        streak: streakMap.get(p.id) ?? 0,
      };
    })
    .sort((a, b) => b.weekXp - a.weekXp);

  const myIndex = ranked.findIndex((r) => r.id === user.id);
  const me = ranked[myIndex];
  const top = ranked.slice(0, 10);
  const inTop = myIndex >= 0 && myIndex < 10;

  // Shaxsiy o'sish — reytingda past bo'lsa ham o'z natijasini ko'rsin
  const growth =
    me && me.prevWeekXp > 0
      ? Math.round(((me.weekXp - me.prevWeekXp) / me.prevWeekXp) * 100)
      : me && me.weekXp > 0
        ? 100
        : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">Reyting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {membership?.group.name ?? "Barcha o'quvchilar"} · shu haftadagi XP
          bo'yicha
        </p>
      </div>

      {/* Shaxsiy o'sish — reytingdan muhimroq */}
      {me && (
        <Card className={growth >= 0 ? "border-success/40" : ""}>
          <CardContent className="flex items-center gap-3 p-4 pt-4">
            <div
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-lg",
                growth >= 0
                  ? "bg-success/10 text-success"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <TrendingUp size={20} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">
                Bu hafta {me.weekXp} XP
                {growth !== 0 && (
                  <span
                    className={cn(
                      "ml-2 text-sm",
                      growth > 0 ? "text-success" : "text-muted-foreground"
                    )}
                  >
                    {growth > 0 ? "+" : ""}
                    {growth}%
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {growth > 0
                  ? "O'tgan haftaga nisbatan o'sish — zo'r!"
                  : me.weekXp > 0
                    ? "Davom eting"
                    : "Bu hafta hali boshlamadingiz"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Trophy size={17} className="text-warning" aria-hidden />
            <CardTitle>Eng faollar</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {top.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Bu hafta hali hech kim XP to'plamagan.
            </p>
          )}

          {top.map((r, i) => {
            const isMe = r.id === user.id;
            return (
              <div
                key={r.id}
                className={cn(
                  "flex items-center gap-3 rounded-md p-2.5",
                  isMe ? "bg-primary/10" : ""
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    i === 0
                      ? "bg-warning/20 text-warning"
                      : i === 1
                        ? "bg-muted-foreground/20 text-muted-foreground"
                        : i === 2
                          ? "bg-warning/10 text-warning"
                          : "text-muted-foreground"
                  )}
                >
                  {i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {r.fullName}
                    {isMe && <span className="ml-1 text-primary">(siz)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {levelFromXp(r.totalXp)}-daraja
                  </p>
                </div>

                {r.streak > 1 && (
                  <Badge variant="warning">
                    <Flame size={11} aria-hidden /> {r.streak}
                  </Badge>
                )}
                <span className="w-12 shrink-0 text-right text-sm font-semibold">
                  {r.weekXp}
                </span>
              </div>
            );
          })}

          {/* Top-10 dan tashqarida bo'lsa — o'z o'rni. Pastdagilar
              boshqalarga ko'rinmaydi. */}
          {me && !inTop && (
            <>
              <p className="py-1 text-center text-xs text-muted-foreground">
                ···
              </p>
              <div className="flex items-center gap-3 rounded-md bg-primary/10 p-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center text-sm font-bold text-muted-foreground">
                  {myIndex + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {me.fullName} <span className="text-primary">(siz)</span>
                  </p>
                </div>
                <span className="w-12 shrink-0 text-right text-sm font-semibold">
                  {me.weekXp}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="pb-2 text-center text-xs text-muted-foreground">
        Reyting har hafta yangilanadi. XP faqat to'g'ri javob uchun emas,
        harakat va qiyinchilik uchun ham beriladi.
      </p>
    </div>
  );
}
