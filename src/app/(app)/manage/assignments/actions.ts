"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import { runTestCases } from "@/lib/sandbox";
import { zodToState, type ActionState } from "@/lib/actions-util";

const testCaseSchema = z.object({
  name: z.string().trim().max(60).optional(),
  stdin: z.string().max(4000).default(""),
  expectedStdout: z.string().max(4000),
  isHidden: z.boolean().default(false),
  points: z.number().int().min(1).max(20).default(1),
});

const assignmentSchema = z.object({
  title: z.string().trim().min(3, "Sarlavha juda qisqa.").max(120),
  description: z.string().trim().min(10, "Vazifa shartini yozing.").max(8000),
  type: z.enum(["CODE", "HTML_CSS", "TEXT", "PROJECT"]),
  language: z.string().trim().max(20).optional(),
  topicId: z.string().min(1, "Mavzuni tanlang."),
  difficulty: z.number().int().min(1).max(5),
  starterCode: z.string().max(8000).optional(),
  solutionCode: z.string().max(8000).optional(),
  maxPoints: z.number().int().min(1).max(1000).default(100),
  testCases: z.array(testCaseSchema).max(20),
  groupIds: z.array(z.string()),
  studentIds: z.array(z.string()),
  dueAt: z.string().optional(),
  publish: z.boolean(),
});

export type AssignmentState = ActionState<{ id: string; warning?: string }>;

/** FormData'dagi JSON maydonlarini xavfsiz o'qish. */
function readJson<T>(formData: FormData, key: string, fallback: T): T {
  const raw = formData.get(key);
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function saveAssignmentAction(
  _prev: AssignmentState,
  formData: FormData
): Promise<AssignmentState> {
  const teacher = await requireTeacher();

  const parsed = assignmentSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type"),
    language: formData.get("language") || undefined,
    topicId: formData.get("topicId"),
    difficulty: Number(formData.get("difficulty") ?? 1),
    starterCode: formData.get("starterCode") || undefined,
    solutionCode: formData.get("solutionCode") || undefined,
    maxPoints: Number(formData.get("maxPoints") ?? 100),
    testCases: readJson(formData, "testCases", []),
    groupIds: readJson(formData, "groupIds", [] as string[]),
    studentIds: readJson(formData, "studentIds", [] as string[]),
    dueAt: formData.get("dueAt") || undefined,
    publish: formData.get("publish") === "1",
  });

  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  if (d.publish && d.groupIds.length === 0 && d.studentIds.length === 0) {
    return { error: "Vazifani kimga berishni tanlang (guruh yoki o'quvchi)." };
  }

  // ---- Yechimni sandbox'da tekshirish ----
  // O'qituvchining o'z yechimi testlardan o'tmasa, test-case'lar noto'g'ri.
  // Bu o'quvchiga buzuq vazifa berilishini oldini oladi.
  let warning: string | undefined;
  if (d.type === "CODE" && d.solutionCode && d.testCases.length > 0) {
    const { outcomes, infraError } = await runTestCases(
      d.language || "python",
      d.solutionCode,
      d.testCases.map((tc, i) => ({
        id: String(i),
        stdin: tc.stdin,
        expectedStdout: tc.expectedStdout,
        points: tc.points,
        order: i,
      }))
    );

    if (infraError) {
      warning = `Yechimni tekshirib bo'lmadi: ${infraError}`;
    } else {
      const failed = outcomes.filter((o) => !o.passed);
      if (failed.length > 0) {
        const first = failed[0];
        const tc = d.testCases[Number(first.testCaseId)];
        return {
          error:
            `Sizning yechimingiz ${failed.length} ta testdan o'tmadi. ` +
            `Test ${Number(first.testCaseId) + 1}: kutilgan "${tc.expectedStdout.trim()}", ` +
            `olingan "${first.actualOutput.trim()}"` +
            (first.stderr ? ` (${first.stderr.split("\n").pop()})` : "") +
            ". Test-case yoki yechimni to'g'rilang.",
        };
      }
    }
  }

  const dueAt = d.dueAt ? new Date(d.dueAt) : null;

  const assignment = await db.assignment.create({
    data: {
      title: d.title,
      description: d.description,
      type: d.type,
      language: d.language,
      topicId: d.topicId,
      difficulty: d.difficulty,
      starterCode: d.starterCode,
      solutionCode: d.solutionCode,
      maxPoints: d.maxPoints,
      status: d.publish ? "PUBLISHED" : "DRAFT",
      source: "TEACHER",
      createdById: teacher.id,
      testCases: {
        create: d.testCases.map((tc, i) => ({
          name: tc.name || null,
          stdin: tc.stdin,
          expectedStdout: tc.expectedStdout,
          isHidden: tc.isHidden,
          points: tc.points,
          order: i,
        })),
      },
      targets: {
        create: [
          ...d.groupIds.map((groupId) => ({ groupId, dueAt })),
          ...d.studentIds.map((userId) => ({ userId, dueAt })),
        ],
      },
    },
  });

  revalidatePath("/manage/assignments");
  revalidatePath("/assignments");
  return { ok: true, data: { id: assignment.id, warning } };
}

export async function setAssignmentStatusAction(
  formData: FormData
): Promise<void> {
  await requireTeacher();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) return;

  await db.assignment.update({
    where: { id },
    data: { status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED" },
  });
  revalidatePath("/manage/assignments");
  revalidatePath("/assignments");
}
