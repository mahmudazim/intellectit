import Link from "next/link";
import { Archive, RotateCcw, Users } from "lucide-react";

import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import { archiveGroupAction, restoreGroupAction } from "./actions";
import { GroupForm } from "./GroupForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Guruhlar" };

export default async function GroupsPage() {
  await requireTeacher();

  const groups = await db.group.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { members: true } } },
  });

  const active = groups.filter((g) => g.isActive);
  const archived = groups.filter((g) => !g.isActive);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">Guruhlar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vazifa butun guruhga beriladi. Sinf va to'garakni alohida guruh qiling.
        </p>
      </div>

      <GroupForm />

      {active.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Hali guruh yo'q. Birinchi guruhni yarating.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {active.map((group) => (
          <Card key={group.id}>
            <CardContent className="flex items-center gap-3 p-4 pt-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users size={18} aria-hidden />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/students?group=${group.id}`}
                    className="font-medium hover:underline"
                  >
                    {group.name}
                  </Link>
                  <Badge variant="neutral">
                    {group.kind === "SCHOOL_CLASS" ? "Sinf" : "To'garak"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {group._count.members} o'quvchi
                  {group.note ? ` · ${group.note}` : ""}
                </p>
              </div>

              <form action={archiveGroupAction}>
                <input type="hidden" name="id" value={group.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  aria-label="Arxivlash"
                  title="Arxivlash"
                >
                  <Archive aria-hidden />
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      {archived.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Arxiv</h2>
          {archived.map((group) => (
            <Card key={group.id} className="opacity-60">
              <CardContent className="flex items-center gap-3 p-3 pt-3">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {group.name}
                </span>
                <form action={restoreGroupAction}>
                  <input type="hidden" name="id" value={group.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    aria-label="Tiklash"
                    title="Tiklash"
                  >
                    <RotateCcw aria-hidden />
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
