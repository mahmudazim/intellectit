import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runSeed } from "../../../../../prisma/seed";

// VAQTINCHALIK: yangi Neon bazasini bir martalik ishga tushirish uchun
// (sxema push + boshlang'ich seed). Ishlatilgandan keyin bu fayl o'chiriladi.

const DDL_SQL = `-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TEACHER', 'STUDENT', 'PARENT');

-- CreateEnum
CREATE TYPE "GroupKind" AS ENUM ('SCHOOL_CLASS', 'CLUB');

-- CreateEnum
CREATE TYPE "Track" AS ENUM ('PYTHON', 'HTML_CSS', 'JAVASCRIPT', 'WEB', 'AI', 'CYBER');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('CODE', 'HTML_CSS', 'TEXT', 'PROJECT');

-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('TEACHER', 'AI_GENERATED', 'AI_PRACTICE');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'QUEUED', 'RUNNING', 'GRADED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiStatus" AS ENUM ('PENDING', 'DONE', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE', 'SHORT_ANSWER', 'CODE_OUTPUT', 'FILL_BLANK');

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('TEACHER', 'AI_GENERATED');

-- CreateEnum
CREATE TYPE "QuizReveal" AS ENUM ('IMMEDIATELY', 'AFTER_SUBMIT', 'AFTER_DUE', 'NEVER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "fullName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "telegramId" BIGINT,
    "telegramUser" TEXT,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePw" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "GroupKind" NOT NULL DEFAULT 'SCHOOL_CLASS',
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "track" "Track" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "prereqSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "AssignmentType" NOT NULL DEFAULT 'CODE',
    "language" TEXT,
    "topicId" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "starterCode" TEXT,
    "solutionCode" TEXT,
    "rubric" TEXT,
    "maxPoints" INTEGER NOT NULL DEFAULT 100,
    "timeLimitMin" INTEGER,
    "source" "AssignmentSource" NOT NULL DEFAULT 'TEACHER',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "name" TEXT,
    "stdin" TEXT NOT NULL DEFAULT '',
    "expectedStdout" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentTarget" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "groupId" TEXT,
    "userId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "AssignmentTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "draftCode" TEXT,
    "codeHash" TEXT,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "testsPassed" INTEGER NOT NULL DEFAULT 0,
    "testsTotal" INTEGER NOT NULL DEFAULT 0,
    "autoScore" INTEGER,
    "finalScore" INTEGER,
    "teacherNote" TEXT,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "actualOutput" TEXT NOT NULL DEFAULT '',
    "stderr" TEXT,
    "runtimeMs" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReview" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "status" "AiStatus" NOT NULL DEFAULT 'PENDING',
    "score" INTEGER,
    "summary" TEXT,
    "strengths" JSONB,
    "issues" JSONB,
    "nextTopics" JSONB,
    "codeQuality" INTEGER,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "cacheReadIn" INTEGER,
    "costUsd" DECIMAL(10,6),
    "latencyMs" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "codeSnippet" TEXT,
    "options" JSONB,
    "correctText" TEXT,
    "explanation" TEXT NOT NULL DEFAULT '',
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "points" INTEGER NOT NULL DEFAULT 1,
    "source" "QuestionSource" NOT NULL DEFAULT 'TEACHER',
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "timeLimitMin" INTEGER,
    "shuffle" BOOLEAN NOT NULL DEFAULT true,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "showAnswersAt" "QuizReveal" NOT NULL DEFAULT 'AFTER_SUBMIT',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "isDiagnostic" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" TIMESTAMP(3),
    "targets" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizItem" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuizItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" INTEGER,
    "maxScore" INTEGER,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerJson" JSONB NOT NULL,
    "isCorrect" BOOLEAN,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "aiFeedback" TEXT,
    "timeSpentSec" INTEGER,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicMastery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "lastPracticeAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicMastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasteryEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "weight" DOUBLE PRECISION NOT NULL,
    "result" DOUBLE PRECISION NOT NULL,
    "scoreBefore" DOUBLE PRECISION NOT NULL,
    "scoreAfter" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasteryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Streak" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "longest" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDay" DATE,
    "freezeCount" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "Streak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'award',
    "tier" INTEGER NOT NULL DEFAULT 1,
    "ruleJson" JSONB NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPref" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramOn" BOOLEAN NOT NULL DEFAULT true,
    "newAssignment" BOOLEAN NOT NULL DEFAULT true,
    "gradeReady" BOOLEAN NOT NULL DEFAULT true,
    "dueReminder" BOOLEAN NOT NULL DEFAULT true,
    "streakWarning" BOOLEAN NOT NULL DEFAULT true,
    "weeklyReport" BOOLEAN NOT NULL DEFAULT true,
    "quietFrom" INTEGER NOT NULL DEFAULT 22,
    "quietTo" INTEGER NOT NULL DEFAULT 7,

    CONSTRAINT "NotificationPref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLinkToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "cacheRead" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_idx" ON "GroupMember"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_userId_groupId_key" ON "GroupMember"("userId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Module_slug_key" ON "Module"("slug");

-- CreateIndex
CREATE INDEX "Module_track_order_idx" ON "Module"("track", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "Topic_moduleId_order_idx" ON "Topic"("moduleId", "order");

-- CreateIndex
CREATE INDEX "Assignment_topicId_status_idx" ON "Assignment"("topicId", "status");

-- CreateIndex
CREATE INDEX "Assignment_status_difficulty_idx" ON "Assignment"("status", "difficulty");

-- CreateIndex
CREATE INDEX "TestCase_assignmentId_order_idx" ON "TestCase"("assignmentId", "order");

-- CreateIndex
CREATE INDEX "AssignmentTarget_assignmentId_idx" ON "AssignmentTarget"("assignmentId");

-- CreateIndex
CREATE INDEX "AssignmentTarget_groupId_idx" ON "AssignmentTarget"("groupId");

-- CreateIndex
CREATE INDEX "AssignmentTarget_userId_idx" ON "AssignmentTarget"("userId");

-- CreateIndex
CREATE INDEX "Submission_studentId_assignmentId_idx" ON "Submission"("studentId", "assignmentId");

-- CreateIndex
CREATE INDEX "Submission_assignmentId_status_idx" ON "Submission"("assignmentId", "status");

-- CreateIndex
CREATE INDEX "Submission_codeHash_idx" ON "Submission"("codeHash");

-- CreateIndex
CREATE INDEX "TestResult_submissionId_order_idx" ON "TestResult"("submissionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "AiReview_submissionId_key" ON "AiReview"("submissionId");

-- CreateIndex
CREATE INDEX "AiReview_status_retryCount_idx" ON "AiReview"("status", "retryCount");

-- CreateIndex
CREATE INDEX "Question_topicId_isApproved_idx" ON "Question"("topicId", "isApproved");

-- CreateIndex
CREATE INDEX "Quiz_status_idx" ON "Quiz"("status");

-- CreateIndex
CREATE INDEX "QuizItem_quizId_order_idx" ON "QuizItem"("quizId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "QuizItem_quizId_questionId_key" ON "QuizItem"("quizId", "questionId");

-- CreateIndex
CREATE INDEX "QuizAttempt_studentId_quizId_idx" ON "QuizAttempt"("studentId", "quizId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAnswer_attemptId_questionId_key" ON "QuizAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "TopicMastery_userId_score_idx" ON "TopicMastery"("userId", "score");

-- CreateIndex
CREATE INDEX "TopicMastery_topicId_score_idx" ON "TopicMastery"("topicId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "TopicMastery_userId_topicId_key" ON "TopicMastery"("userId", "topicId");

-- CreateIndex
CREATE INDEX "MasteryEvent_userId_topicId_createdAt_idx" ON "MasteryEvent"("userId", "topicId", "createdAt");

-- CreateIndex
CREATE INDEX "XpEvent_userId_createdAt_idx" ON "XpEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Streak_userId_key" ON "Streak"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_slug_key" ON "Badge"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPref_userId_key" ON "NotificationPref"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLinkToken_token_key" ON "TelegramLinkToken"("token");

-- CreateIndex
CREATE INDEX "TelegramLinkToken_expiresAt_idx" ON "TelegramLinkToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_createdAt_idx" ON "AiUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_provider_createdAt_idx" ON "AiUsageLog"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentTarget" ADD CONSTRAINT "AssignmentTarget_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentTarget" ADD CONSTRAINT "AssignmentTarget_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentTarget" ADD CONSTRAINT "AssignmentTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReview" ADD CONSTRAINT "AiReview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizItem" ADD CONSTRAINT "QuizItem_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizItem" ADD CONSTRAINT "QuizItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicMastery" ADD CONSTRAINT "TopicMastery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicMastery" ADD CONSTRAINT "TopicMastery_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryEvent" ADD CONSTRAINT "MasteryEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryEvent" ADD CONSTRAINT "MasteryEvent_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Streak" ADD CONSTRAINT "Streak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPref" ADD CONSTRAINT "NotificationPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLinkToken" ADD CONSTRAINT "TelegramLinkToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
`;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-bootstrap-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const statements = DDL_SQL.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
  const ranStatements: string[] = [];
  try {
    for (const stmt of statements) {
      await db.$executeRawUnsafe(stmt);
      ranStatements.push(stmt.slice(0, 40));
    }
  } catch (e) {
    return NextResponse.json(
      {
        step: "schema",
        error: e instanceof Error ? e.message : String(e),
        ranCount: ranStatements.length,
      },
      { status: 500 },
    );
  }

  try {
    await runSeed();
  } catch (e) {
    return NextResponse.json(
      { step: "seed", error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, tablesCreated: statements.length });
}
