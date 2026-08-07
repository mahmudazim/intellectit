import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getApiUser } from "@/lib/guards";

export const runtime = "nodejs";

/** Bitta javob natijasi. O'quvchi faqat O'ZINING javobini ko'ra oladi. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Avtorizatsiya kerak." }, { status: 401 });
  }

  const { id } = await params;

  const submission = await db.submission.findUnique({
    where: { id },
    select: {
      id: true,
      studentId: true,
      testsPassed: true,
      testsTotal: true,
      autoScore: true,
      finalScore: true,
      status: true,
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
          error: true,
          // provider/model/cost ATAYLAB yuborilmaydi — o'quvchiga kerak emas
        },
      },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "Topilmadi." }, { status: 404 });
  }

  // O'qituvchi hammasini, o'quvchi faqat o'zinikini ko'radi
  if (user.role !== "TEACHER" && submission.studentId !== user.id) {
    return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 403 });
  }

  return NextResponse.json({
    testsPassed: submission.testsPassed,
    testsTotal: submission.testsTotal,
    autoScore: submission.autoScore,
    finalScore: submission.finalScore,
    results: submission.testResults,
    ai: submission.aiReview
      ? {
          status: submission.aiReview.status,
          summary: submission.aiReview.summary,
          strengths: submission.aiReview.strengths,
          issues: submission.aiReview.issues,
          codeQuality: submission.aiReview.codeQuality,
          // Xato matnini o'quvchiga ko'rsatmaymiz — faqat holat
        }
      : null,
  });
}
