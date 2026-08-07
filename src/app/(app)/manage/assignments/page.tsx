import Link from "next/link";
import { Plus } from "lucide-react";

import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import { setAssignmentStatusAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Vazifalar" };

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "neutral" | "warning" }> = {
  PUBLISHED: { label: "Berilgan", variant: "success" },
  DRAFT: { label: "Qoralama", variant: "neutral" },
  PENDING_REVIEW: { label: "Tasdiq kutmoqda", variant: "warning" },
  ARCHIVED: { label: "Arxiv", variant: "neutral" },
};

export default async function ManageAssignmentsPage() {
  await requireTeacher();

  const assignments = await db.assignment.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      difficulty: true,
      type: true,
      createdAt: true,
      topic: { select: { name: true } },
      _count: { select: { testCases: true, submissions: true, targets: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">
            Vazifalar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {assignments.length} ta vazifa
          </p>
        </div>
        <Link
          href="/manage/assignments/new"
          className={buttonVariants({ className: "w-full md:w-auto" })}
        >
          <Plus aria-hidden /> Yangi vazifa
        </Link>
      </div>

      {assignments.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Hali vazifa yo'q. Birinchisini yarating.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {assignments.map((a) => {
          const status = STATUS_LABEL[a.status] ?? STATUS_LABEL.DRAFT;
          return (
            <Card key={a.id}>
              <CardContent className="space-y-3 p-4 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/manage/assignments/${a.id}/submissions`}
                      className="font-medium leading-snug hover:underline"
                    >
                      {a.title}
                    </Link>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {a.topic.name} · {a.difficulty}-daraja ·{" "}
                      {a._count.testCases} test
                    </p>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {a._count.submissions} javob · {a._count.targets} manzil
                  </span>

                  <div className="ml-auto flex gap-2">
                    <Link
                      href={`/manage/assignments/${a.id}/submissions`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      Javoblar
                    </Link>
                    {a.status === "DRAFT" && (
                      <form action={setAssignmentStatusAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="status" value="PUBLISHED" />
                        <Button type="submit" size="sm">
                          Berish
                        </Button>
                      </form>
                    )}
                    {a.status === "PUBLISHED" && (
                      <form action={setAssignmentStatusAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="status" value="ARCHIVED" />
                        <Button type="submit" size="sm" variant="ghost">
                          Arxivlash
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
