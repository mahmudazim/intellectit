import { Award, Flame, Snowflake, Zap } from "lucide-react";

import { db } from "@/lib/db";
import { requireStudent } from "@/lib/guards";
import { levelProgress, totalXp, weeklyXp } from "@/lib/gamification/xp";
import { BadgeIcon } from "@/components/gamification/BadgeIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TelegramCard } from "./TelegramCard";

export const metadata = { title: "Profil" };

const TIER_STYLE: Record<number, string> = {
  1: "bg-warning/15 text-warning",
  2: "bg-muted-foreground/15 text-muted-foreground",
  3: "bg-primary/15 text-primary",
};

export default async function ProfilePage() {
  const user = await requireStudent();

  const [xp, week, streak, allBadges, mine, group, me] = await Promise.all([
    totalXp(user.id),
    weeklyXp(user.id),
    db.streak.findUnique({ where: { userId: user.id } }),
    db.badge.findMany({ orderBy: [{ tier: "asc" }, { slug: "asc" }] }),
    db.userBadge.findMany({
      where: { userId: user.id },
      select: { badgeId: true, earnedAt: true },
    }),
    db.groupMember.findFirst({
      where: { userId: user.id },
      select: { group: { select: { name: true } } },
    }),
    db.user.findUnique({
      where: { id: user.id },
      select: {
        telegramId: true,
        telegramUser: true,
        notificationPref: true,
      },
    }),
  ]);

  const pref = me?.notificationPref;

  const earnedMap = new Map(mine.map((m) => [m.badgeId, m.earnedAt]));
  const progress = levelProgress(xp);

  return (
    <div className="space-y-5">
      {/* Shaxsiy karta */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
              {user.fullName
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold leading-tight">
                {user.fullName}
              </p>
              <p className="text-sm text-muted-foreground">
                {group?.group.name ?? "Guruhsiz"}
              </p>
            </div>
          </div>

          {/* Daraja */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{progress.level}-daraja</span>
              <span className="text-muted-foreground">
                {progress.current} / {progress.needed} XP
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Keyingi darajagacha {progress.needed - progress.current} XP
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Ko'rsatkichlar */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-3 pt-3">
            <Zap size={18} className="text-primary" aria-hidden />
            <span className="text-lg font-bold leading-none">{xp}</span>
            <span className="text-[11px] text-muted-foreground">Jami XP</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-3 pt-3">
            <Flame size={18} className="text-warning" aria-hidden />
            <span className="text-lg font-bold leading-none">
              {streak?.current ?? 0}
            </span>
            <span className="text-[11px] text-muted-foreground">Streak</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-3 pt-3">
            <Award size={18} className="text-success" aria-hidden />
            <span className="text-lg font-bold leading-none">{mine.length}</span>
            <span className="text-[11px] text-muted-foreground">Nishon</span>
          </CardContent>
        </Card>
      </div>

      {/* Streak tafsiloti */}
      {streak && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4 pt-4 text-sm">
            <span className="text-muted-foreground">
              Eng uzun streak: <strong>{streak.longest}</strong> kun
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-muted-foreground">
              <Snowflake size={14} aria-hidden />
              {streak.freezeCount} ta muzlatish qoldi
            </span>
          </CardContent>
        </Card>
      )}

      {/* Haftalik faollik */}
      <Card>
        <CardContent className="p-4 pt-4">
          <p className="text-sm">
            <span className="text-muted-foreground">Bu hafta: </span>
            <strong>{week} XP</strong>
          </p>
        </CardContent>
      </Card>

      {/* Nishonlar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Nishonlar ({mine.length}/{allBadges.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {allBadges.map((b) => {
              const earned = earnedMap.get(b.id);
              return (
                <div
                  key={b.id}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-md border p-3 text-center",
                    earned ? "border-border" : "border-dashed opacity-45"
                  )}
                  title={b.description}
                >
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl",
                      earned ? TIER_STYLE[b.tier] ?? TIER_STYLE[1] : "bg-muted"
                    )}
                  >
                    <BadgeIcon name={b.icon} size={20} />
                  </span>
                  <span className="text-xs font-medium leading-tight">
                    {b.name}
                  </span>
                  <span className="text-[11px] leading-tight text-muted-foreground">
                    {b.description}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <TelegramCard
        linked={Boolean(me?.telegramId)}
        telegramUser={me?.telegramUser ?? null}
        prefs={{
          telegramOn: pref?.telegramOn ?? true,
          newAssignment: pref?.newAssignment ?? true,
          gradeReady: pref?.gradeReady ?? true,
          dueReminder: pref?.dueReminder ?? true,
          streakWarning: pref?.streakWarning ?? true,
        }}
      />

      <form action="/api/logout" method="post">
        <Button type="submit" variant="outline" size="block">
          Chiqish
        </Button>
      </form>
    </div>
  );
}
