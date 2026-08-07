import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, CircleX } from "lucide-react";

import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function AssignmentSubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();
  const { id } = await params;

  const assignment = await db.assignment.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      maxPoints: true,
      topic: { select: { name: true } },
      testCases: { select: { id: true } },
    },
  });
  if (!assignment) notFound();

  // Har bir o'quvchining eng oxirgi javobi
  const submissions = await db.submission.findMany({
    where: { assignmentId: id, status: { not: "DRAFT" } },
    orderBy: [{ studentId: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      studentId: true,
      attemptNo: true,
      status: true,
      testsPassed: true,
      testsTotal: true,
      finalScore: true,
      isLate: true,
      submittedAt: true,
      code: true,
      codeHash: true,
      student: { select: { fullName: true } },
    },
  });

  const latest = new Map<string, (typeof submissions)[number]>();
  for (const s of submissions) {
    if (!latest.has(s.studentId)) latest.set(s.studentId, s);
  }
  const rows = [...latest.values()].sort((a, b) =>
    a.student.fullName.localeCompare(b.student.fullName)
  );

  // Bir xil kod — ko'chirish shubhasi
  const hashCount = new Map<string, number>();
  for (const r of rows) {
    if (r.codeHash) hashCount.set(r.codeHash, (hashCount.get(r.codeHash) ?? 0) + 1);
  }

  const avg =
    rows.length > 0
      ? Math.round(
          rows.reduce((sum, r) => sum + (r.finalScore ?? 0), 0) / rows.length
        )
      : 0;

  return (
    <div className="space-y-4">
      <Link
        href="/manage/assignments"
        className="inline-flex h-11 items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft size={16} aria-hidden /> Vazifalar
      </Link>

      <div>
        <h1 className="text-lg font-bold leading-snug tracking-tight md:text-2xl">
          {assignment.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {assignment.topic.name} · {rows.length} javob · o'rtacha ball {avg}
        </p>
      </div>

      {rows.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Hali javob yo'q.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {rows.map((r) => {
          const allPassed =
            r.testsTotal > 0 && r.testsPassed === r.testsTotal;
          const duplicate = r.codeHash && (hashCount.get(r.codeHash) ?? 0) > 1;

          return (
            <Card key={r.id}>
              <CardContent className="space-y-2 p-4 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">
                      {r.student.fullName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {r.attemptNo}-urinish
                      {r.testsTotal > 0
                        ? ` · ${r.testsPassed}/${r.testsTotal} test`
                        : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {r.testsTotal > 0 &&
                      (allPassed ? (
                        <CircleCheck size={18} className="text-success" aria-hidden />
                      ) : (
                        <CircleX size={18} className="text-danger" aria-hidden />
                      ))}
                    <span className="text-lg font-bold">{r.finalScore ?? 0}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {r.isLate && <Badge variant="warning">Kech topshirdi</Badge>}
                  {duplicate && (
                    <Badge variant="danger">Bir xil kod topildi</Badge>
                  )}
                  {r.status === "FAILED" && (
                    <Badge variant="danger">Tekshirilmadi</Badge>
                  )}
                </div>

                <details className="rounded-md border border-border">
                  <summary className="cursor-pointer p-2.5 text-sm font-medium">
                    Kodni ko'rish
                  </summary>
                  <pre className="scroll-x border-t border-border p-2.5 font-mono text-xs">
                    {r.code}
                  </pre>
                </details>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
