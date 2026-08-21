import { db } from "@/lib/db";
import { grantRewards } from "@/lib/gamification";
import { notifyBadge, notifyGradeReady } from "@/lib/telegram/notify";
import { applySubmissionEvidence } from "@/lib/mastery/update";
import { gradeWithFailover } from "./router";
import type { GradeInput } from "./types";

/**
 * Bitta javobni AI bilan baholaydi va natijani bazaga yozadi.
 *
 * Bu funksiya javob (HTTP response) yuborilgandan KEYIN chaqiriladi —
 * o'quvchi test natijasini darhol ko'radi, AI izohi bir necha soniyadan
 * keyin qo'shiladi.
 *
 * Hech qachon xato tashlamaydi: AI ishlamasa ham o'quvchining balli saqlanadi.
 */
export async function gradeSubmissionWithAi(submissionId: string): Promise<void> {
  try {
    const submission = await db.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        studentId: true,
        code: true,
        codeHash: true,
        testsPassed: true,
        testsTotal: true,
        assignmentId: true,
        assignment: {
          select: {
            title: true,
            description: true,
            type: true,
            language: true,
            difficulty: true,
            rubric: true,
            topic: { select: { slug: true } },
          },
        },
        testResults: {
          where: { passed: false },
          orderBy: { order: "asc" },
          take: 4,
          select: {
            actualOutput: true,
            stderr: true,
            testCaseId: true,
          },
        },
      },
    });

    if (!submission) return;

    // ---- Takroriy chaqiruvni oldini olish ----
    // Bir xil kod (ko'chirgan yoki qayta yuborgan) uchun avvalgi AI javobini
    // qayta ishlatamiz — pul sarflanmaydi.
    if (submission.codeHash) {
      const cached = await db.aiReview.findFirst({
        where: {
          status: "DONE",
          submission: {
            assignmentId: submission.assignmentId,
            codeHash: submission.codeHash,
            id: { not: submission.id },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      if (cached) {
        await db.aiReview.upsert({
          where: { submissionId: submission.id },
          create: {
            submissionId: submission.id,
            status: "DONE",
            provider: cached.provider,
            model: cached.model,
            score: cached.score,
            summary: cached.summary,
            strengths: cached.strengths ?? undefined,
            issues: cached.issues ?? undefined,
            nextTopics: cached.nextTopics ?? undefined,
            codeQuality: cached.codeQuality,
            tokensIn: 0,
            tokensOut: 0,
            cacheReadIn: 0,
            costUsd: 0,
            latencyMs: 0,
          },
          update: {
            status: "DONE",
            provider: cached.provider,
            model: cached.model,
            score: cached.score,
            summary: cached.summary,
            strengths: cached.strengths ?? undefined,
            issues: cached.issues ?? undefined,
            nextTopics: cached.nextTopics ?? undefined,
            codeQuality: cached.codeQuality,
            error: null,
          },
        });
        await applyFinalScore(submission.id);
        await applySubmissionEvidence(submission.id);
      await notifyAfterGrading(submission.id, submission.studentId);
        return;
      }
    }

    // ---- Mavzu slug'lari ----
    const topics = await db.topic.findMany({ select: { slug: true } });
    const topicSlugs = topics.map((t) => t.slug);

    // Kutilgan chiqishni test-case'lardan olamiz
    const failedIds = submission.testResults.map((r) => r.testCaseId);
    const failedCases = failedIds.length
      ? await db.testCase.findMany({
          where: { id: { in: failedIds } },
          select: { id: true, expectedStdout: true },
        })
      : [];
    const expectedById = new Map(
      failedCases.map((c) => [c.id, c.expectedStdout])
    );

    const input: GradeInput = {
      assignment: {
        title: submission.assignment.title,
        description: submission.assignment.description,
        type: submission.assignment.type,
        language: submission.assignment.language ?? "python",
        difficulty: submission.assignment.difficulty,
        rubric: submission.assignment.rubric,
      },
      topicSlugs,
      primaryTopicSlug: submission.assignment.topic.slug,
      studentCode: submission.code,
      testSummary: {
        passed: submission.testsPassed,
        total: submission.testsTotal,
        failures: submission.testResults.map((r) => ({
          expected: expectedById.get(r.testCaseId) ?? "",
          actual: r.actualOutput,
          stderr: r.stderr,
        })),
      },
    };

    const attempt = await gradeWithFailover(input);

    if (attempt.status === "skipped") {
      await db.aiReview.upsert({
        where: { submissionId: submission.id },
        create: {
          submissionId: submission.id,
          status: "SKIPPED",
          error: attempt.reason,
        },
        update: { status: "SKIPPED", error: attempt.reason },
      });
      // AI ishlamasa ham test natijasi mavzu bahosiga kiradi
      await applySubmissionEvidence(submission.id);
      await notifyAfterGrading(submission.id, submission.studentId);
      return;
    }

    if (attempt.status === "failed") {
      const existing = await db.aiReview.findUnique({
        where: { submissionId: submission.id },
        select: { retryCount: true },
      });
      await db.aiReview.upsert({
        where: { submissionId: submission.id },
        create: {
          submissionId: submission.id,
          status: "FAILED",
          error: attempt.error,
          retryCount: 1,
        },
        update: {
          status: "FAILED",
          error: attempt.error,
          retryCount: (existing?.retryCount ?? 0) + 1,
        },
      });
      await applySubmissionEvidence(submission.id);
      await notifyAfterGrading(submission.id, submission.studentId);
      return;
    }

    const { result, meta } = attempt.outcome;

    await db.aiReview.upsert({
      where: { submissionId: submission.id },
      create: {
        submissionId: submission.id,
        status: "DONE",
        provider: meta.provider,
        model: meta.model,
        score: result.score,
        summary: result.summary,
        strengths: result.strengths,
        issues: result.issues,
        nextTopics: result.nextTopics,
        codeQuality: result.codeQuality,
        tokensIn: meta.tokensIn,
        tokensOut: meta.tokensOut,
        cacheReadIn: meta.cacheRead,
        costUsd: meta.costUsd,
        latencyMs: meta.latencyMs,
      },
      update: {
        status: "DONE",
        provider: meta.provider,
        model: meta.model,
        score: result.score,
        summary: result.summary,
        strengths: result.strengths,
        issues: result.issues,
        nextTopics: result.nextTopics,
        codeQuality: result.codeQuality,
        tokensIn: meta.tokensIn,
        tokensOut: meta.tokensOut,
        cacheReadIn: meta.cacheRead,
        costUsd: meta.costUsd,
        latencyMs: meta.latencyMs,
        error: null,
      },
    });

    await applyFinalScore(submission.id);
    // AI xatolari ham mavzu bahosiga kiradi — shuning uchun AI'dan KEYIN
    await applySubmissionEvidence(submission.id);
      await notifyAfterGrading(submission.id, submission.studentId);
  } catch (e) {
    // Bu funksiya HECH QACHON tashqariga xato tashlamaydi
    console.error("[ai] baholashda kutilmagan xato:", e);
    await db.aiReview
      .upsert({
        where: { submissionId },
        create: {
          submissionId,
          status: "FAILED",
          error: e instanceof Error ? e.message.slice(0, 400) : String(e),
        },
        update: {
          status: "FAILED",
          error: e instanceof Error ? e.message.slice(0, 400) : String(e),
        },
      })
      .catch(() => {});
  }
}

/**
 * Yakuniy ball.
 *
 * Avtomatik testi bor vazifalar (CODE): 85% test natijasi + 15% AI kod
 * sifati — test ustun, chunki u obyektiv, AI faqat "chiroyli yozilganmi"
 * ni baholaydi.
 *
 * Avtomatik testi yo'q vazifalar (HTML_CSS, TEXT, PROJECT): obyektiv
 * signal yo'q, shuning uchun AI'ning o'zi chiqargan umumiy ball (85%)
 * + kod sifati (15%) ishlatiladi.
 *
 * O'qituvchi qo'lda tuzatgan bo'lsa (teacherNote bor) — tegilmaydi.
 */
async function applyFinalScore(submissionId: string) {
  const s = await db.submission.findUnique({
    where: { id: submissionId },
    select: {
      autoScore: true,
      teacherNote: true,
      aiReview: { select: { score: true, codeQuality: true, status: true } },
    },
  });

  if (!s || s.teacherNote) return;
  if (s.aiReview?.status !== "DONE" || s.aiReview.codeQuality === null) return;

  const primary = s.autoScore ?? s.aiReview.score;
  if (primary === null) return;

  const final = Math.round(primary * 0.85 + s.aiReview.codeQuality * 0.15);

  await db.submission.update({
    where: { id: submissionId },
    data: { finalScore: Math.max(0, Math.min(100, final)) },
  });
}


/**
 * Baholash tugagach: mukofot beradi va Telegram'ga xabar yuboradi.
 * Xabar mukofotdan KEYIN — yangi nishon haqida ham aytish uchun.
 */
async function notifyAfterGrading(submissionId: string, studentId: string) {
  const rewards = await grantRewards(studentId, {
    type: "submission",
    id: submissionId,
  });

  const s = await db.submission.findUnique({
    where: { id: submissionId },
    select: {
      assignmentId: true,
      finalScore: true,
      testsPassed: true,
      testsTotal: true,
      assignment: { select: { title: true } },
      aiReview: { select: { summary: true, status: true } },
    },
  });
  if (!s) return;

  await notifyGradeReady(
    studentId,
    s.assignment.title,
    s.assignmentId,
    s.finalScore ?? 0,
    s.testsPassed,
    s.testsTotal,
    s.aiReview?.status === "DONE" ? s.aiReview.summary : null
  );

  for (const badge of rewards.newBadges) {
    await notifyBadge(studentId, badge);
  }
}
