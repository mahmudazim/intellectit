import { Ban, CircleCheck } from "lucide-react";

import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import { toggleStudentActiveAction } from "./actions";
import { GroupSelect } from "./GroupSelect";
import { ResetPasswordButton } from "./ResetPasswordButton";
import { StudentForm } from "./StudentForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "O'quvchilar" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireTeacher();

  const params = await searchParams;
  const groupFilter = typeof params.group === "string" ? params.group : undefined;

  const [groups, students] = await Promise.all([
    db.group.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.user.findMany({
      where: {
        role: "STUDENT",
        ...(groupFilter ? { groups: { some: { groupId: groupFilter } } } : {}),
      },
      orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
      select: {
        id: true,
        fullName: true,
        username: true,
        isActive: true,
        mustChangePw: true,
        lastSeenAt: true,
        telegramId: true,
        groups: { select: { groupId: true } },
      },
    }),
  ]);

  const activeGroup = groups.find((g) => g.id === groupFilter);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          O'quvchilar
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {activeGroup ? `${activeGroup.name} — ` : ""}
          {students.length} o'quvchi. Parol avtomatik yaratiladi va faqat bir
          marta ko'rsatiladi.
        </p>
      </div>

      <StudentForm groups={groups} defaultGroupId={groupFilter} />

      {students.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Hali o'quvchi yo'q.
          </CardContent>
        </Card>
      )}

      {/* Telefonda kartochka, kompyuterda ham kartochka — jadval o'rniga,
          chunki har qatorda 4 ta interaktiv element bor. */}
      <div className="space-y-3">
        {students.map((s) => (
          <Card key={s.id} className={s.isActive ? "" : "opacity-60"}>
            <CardContent className="space-y-3 p-4 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{s.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    <code>{s.username}</code>
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {s.mustChangePw && (
                    <Badge variant="warning">Parol yangilanmagan</Badge>
                  )}
                  {s.telegramId && <Badge variant="success">Telegram</Badge>}
                  {!s.isActive && <Badge variant="neutral">Faol emas</Badge>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <GroupSelect
                  userId={s.id}
                  groups={groups}
                  currentGroupId={s.groups[0]?.groupId}
                />

                <div className="ml-auto flex items-center gap-1">
                  <ResetPasswordButton studentId={s.id} />
                  <form action={toggleStudentActiveAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label={s.isActive ? "Faolsizlantirish" : "Faollashtirish"}
                      title={s.isActive ? "Faolsizlantirish" : "Faollashtirish"}
                    >
                      {s.isActive ? <Ban aria-hidden /> : <CircleCheck aria-hidden />}
                    </Button>
                  </form>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
