import { createHash } from "node:crypto";
import { NextResponse, after } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getApiUser } from "@/lib/guards";
import { canStudentAccess, getDueAt } from "@/lib/assignments";
import { runTestCases } from "@/lib/sandbox";
import { gradeSubmissionWithAi } from "@/lib/ai/gradeSubmission";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  assignmentId: z.string().min(1),
  code: z.string().max(20000),
  /** true — faqat qoralama saqlash (tekshirilmaydi) */
  draft: z.boolean().optional(),
});

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Avtorizatsiya kerak." }, { status: 401 });
  }
  if (user.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Faqat o'quvchi javob yubora oladi." },
      { status: 403 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 });
  }
  const { assignmentId, code, draft } = parsed.data;

  // Boshqa o'quvchiga berilgan vazifaga kirishning oldini olamiz
  if (!(await canStudentAccess(user.id, assignmentId))) {
    return NextResponse.json({ error: "Vazifa topilmadi." }, { status: 404 });
  }

  // ---------- Qoralama: tekshirmasdan saqlash ----------
  if (draft) {
    const existing = await db.submission.findFirst({
      where: { studentId: user.id, assignmentId, status: "DRAFT" },
      select: { id: true },
    });

    if (existing) {
      await db.submission.update({
        where: { id: existing.id },
        data: { draftCode: code },
      });
    } else {
      await db.submission.create({
        data: {
          assignmentId,
          studentId: user.id,
          draftCode: code,
          status: "DRAFT",
        },
      });
    }
    return NextResponse.json({ ok: true, draft: true });
  }

  if (!code.trim()) {
    return NextResponse.json({ error: "Kod bo'sh." }, { status: 400 });
  }

  // ---------- Haqiqiy yuborish ----------
  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      type: true,
      language: true,
      maxPoints: true,
      // solutionCode ATAYLAB olinmaydi — o'quvchiga hech qachon ketmasin
      testCases: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          stdin: true,
          expectedStdout: true,
          points: true,
          order: true,
          isHidden: true,
        },
      },
    },
  });
  if (!assignment) {
    return NextResponse.json({ error: "Vazifa topilmadi." }, { status: 404 });
  }

  const attemptCount = await db.submission.count({
    where: { studentId: user.id, assignmentId, status: { not: "DRAFT" } },
  });

  const dueAt = await getDueAt(user.id, assignmentId);
  const isLate = dueAt ? new Date() > dueAt : false;
  const codeHash = createHash("sha256").update(code).digest("hex");

  const submission = await db.submission.create({
    data: {
      assignmentId,
      studentId: user.id,
      code,
      codeHash,
      attemptNo: attemptCount + 1,
      status: "RUNNING",
      isLate,
      submittedAt: new Date(),
      testsTotal: assignment.testCases.length,
    },
    select: { id: true },
  });

  // ---------- Sandbox ----------
  let testsPassed = 0;
  let autoScore: number | null = null;
  let infraError: string | undefined;

  if (assignment.type === "CODE" && assignment.testCases.length > 0) {
    const result = await runTestCases(
      assignment.language || "python",
      code,
      assignment.testCases
    );
    infraError = result.infraError;

    if (!infraError) {
      await db.testResult.createMany({
        data: result.outcomes.map((o) => ({
          submissionId: submission.id,
          testCaseId: o.testCaseId,
          passed: o.passed,
          actualOutput: o.actualOutput,
          stderr: o.stderr,
          runtimeMs: o.runtimeMs,
          order: o.order,
        })),
      });

      testsPassed = result.outcomes.filter((o) => o.passed).length;

      const totalPoints = assignment.testCases.reduce(
        (sum, tc) => sum + tc.points,
        0
      );
      const earned = result.outcomes.reduce((sum, o) => {
        const tc = assignment.testCases.find((t) => t.id === o.testCaseId);
        return sum + (o.passed ? (tc?.points ?? 1) : 0);
      }, 0);
      autoScore = totalPoints > 0 ? Math.round((earned / totalPoints) * 100) : 0;
    }
  }

  const updated = await db.submission.update({
    where: { id: submission.id },
    data: {
      status: infraError ? "FAILED" : "GRADED",
      testsPassed,
      autoScore,
      // Bosqich 2 da AI balli bilan birlashtiriladi
      finalScore: autoScore,
      gradedAt: infraError ? null : new Date(),
    },
    select: { id: true },
  });

  // Qoralamani tozalaymiz — endi kerak emas
  await db.submission.deleteMany({
    where: { studentId: user.id, assignmentId, status: "DRAFT" },
  });

  if (infraError) {
    return NextResponse.json(
      { submissionId: updated.id, error: infraError },
      { status: 503 }
    );
  }

  // AI baholash 5-20 soniya oladi — o'quvchi kutmasin.
  // `after()` javob yuborilgandan keyin ishlaydi (Vercel'da ham).
  if (assignment.type === "CODE") {
    await db.aiReview.upsert({
      where: { submissionId: updated.id },
      create: { submissionId: updated.id, status: "PENDING" },
      update: { status: "PENDING", error: null },
    });
    after(() => gradeSubmissionWithAi(updated.id));
  }

  return NextResponse.json({
    submissionId: updated.id,
    testsPassed,
    testsTotal: assignment.testCases.length,
    autoScore,
    aiPending: assignment.type === "CODE",
  });
}
