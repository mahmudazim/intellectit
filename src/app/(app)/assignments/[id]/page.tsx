import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";

import { db } from "@/lib/db";
import { requireStudent } from "@/lib/guards";
import { canStudentAccess, getDueAt } from "@/lib/assignments";
import { Badge } from "@/components/ui/badge";
import type { AiReviewData } from "@/components/AiReviewPanel";
import { SolveWorkspace, type LastResult } from "./SolveWorkspace";

export default async function SolveAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStudent();
  const { id } = await params;

  if (!(await canStudentAccess(user.id, id))) notFound();

  const assignment = await db.assignment.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      language: true,
      difficulty: true,
      starterCode: true,
      // solutionCode ATAYLAB tanlanmadi — o'quvchiga hech qachon ketmasin
      topic: { select: { name: true } },
      testCases: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          isHidden: true,
          stdin: true,
          expectedStdout: true,
        },
      },
    },
  });
  if (!assignment) notFound();

  // Yashirin testlarning kirish/chiqishi olib tashlanadi
  const visibleTests = assignment.testCases.map((t) => ({
    id: t.id,
    order: t.order,
    isHidden: t.isHidden,
    stdin: t.isHidden ? null : t.stdin,
    expectedStdout: t.isHidden ? null : t.expectedStdout,
  }));

  const [dueAt, draft, lastGraded] = await Promise.all([
    getDueAt(user.id, id),
    db.submission.findFirst({
      where: { studentId: user.id, assignmentId: id, status: "DRAFT" },
      select: { draftCode: true },
    }),
    db.submission.findFirst({
      where: {
        studentId: user.id,
        assignmentId: id,
        status: { in: ["GRADED", "FAILED"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        code: true,
        testsPassed: true,
        testsTotal: true,
        autoScore: true,
        testResults: {
          orderBy: { order: "asc" },
          select: {
            testCaseId: true,
            passed: true,
            actualOutput: true,
            stderr: true,
          },
        },
        aiReview: {
          select: {
            status: true,
            summary: true,
            strengths: true,
            issues: true,
            codeQuality: true,
          },
        },
      },
    }),
  ]);

  const initialResult: LastResult | null = lastGraded
    ? {
        testsPassed: lastGraded.testsPassed,
        testsTotal: lastGraded.testsTotal,
        autoScore: lastGraded.autoScore,
        results: lastGraded.testResults,
        ai: lastGraded.aiReview
          ? {
              status: lastGraded.aiReview.status,
              summary: lastGraded.aiReview.summary,
              strengths: lastGraded.aiReview.strengths as string[] | null,
              issues: lastGraded.aiReview.issues as AiReviewData["issues"],
              codeQuality: lastGraded.aiReview.codeQuality,
            }
          : null,
      }
    : null;

  const savedCode = draft?.draftCode ?? lastGraded?.code ?? null;
  const overdue = dueAt ? new Date() > dueAt : false;

  return (
    <div className="space-y-4">
      <Link
        href="/assignments"
        className="inline-flex h-11 items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft size={16} aria-hidden /> Vazifalar
      </Link>

      <div>
        <h1 className="text-lg font-bold leading-snug tracking-tight md:text-2xl">
          {assignment.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{assignment.topic.name}</Badge>
          <Badge variant="neutral">{assignment.difficulty}-daraja</Badge>
          {dueAt && (
            <Badge variant={overdue ? "danger" : "warning"}>
              <Clock size={12} aria-hidden />
              {overdue ? "Muddat o'tdi" : "Muddat bor"}
            </Badge>
          )}
        </div>
      </div>

      <SolveWorkspace
        assignmentId={assignment.id}
        description={assignment.description}
        language={assignment.language ?? "python"}
        type={assignment.type}
        starterCode={assignment.starterCode ?? ""}
        savedCode={savedCode}
        tests={visibleTests}
        initialResult={initialResult}
      />
    </div>
  );
}
