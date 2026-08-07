import Link from "next/link";
import { BookOpen, ClipboardList, Layers, Users } from "lucide-react";

import { requireTeacher } from "@/lib/guards";
import { db } from "@/lib/db";
import { AiBudgetCard } from "@/components/AiBudgetCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "O'qituvchi paneli" };

export default async function TeacherDashboard() {
  const user = await requireTeacher();

  const [students, groups, topics, assignments, pendingReview] =
    await Promise.all([
      db.user.count({ where: { role: "STUDENT", isActive: true } }),
      db.group.count({ where: { isActive: true } }),
      db.topic.count(),
      db.assignment.count({ where: { status: "PUBLISHED" } }),
      db.assignment.count({ where: { status: "PENDING_REVIEW" } }),
    ]);

  const stats = [
    { label: "O'quvchi", value: students, icon: Users, href: "/students" },
    { label: "Guruh", value: groups, icon: Layers, href: "/groups" },
    { label: "Mavzu", value: topics, icon: BookOpen, href: "/topics" },
    {
      label: "Vazifa",
      value: assignments,
      icon: ClipboardList,
      href: "/manage/assignments",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          Salom, {user.fullName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sinf holati va tekshirilishi kerak bo'lgan ishlar.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="block">
            <Card className="transition-colors hover:border-primary/40">
              <CardContent className="flex items-center gap-3 p-4 pt-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon size={18} aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold leading-none">{value}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {label}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <AiBudgetCard />

      {pendingReview > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 pt-4">
            <Link href="/review-queue" className="text-sm font-medium">
              {pendingReview} ta AI yaratgan vazifa tasdiqlashingizni kutmoqda →
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Keyingi qadam</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Tizim tayyor. Boshlash uchun: guruh yarating → o'quvchilarni qo'shing
            → birinchi vazifani bering.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
