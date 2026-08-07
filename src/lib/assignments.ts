import { db } from "@/lib/db";

/**
 * O'quvchiga berilgan vazifalar.
 *
 * Vazifa ikki yo'l bilan beriladi: guruh orqali yoki shaxsan. Shuning uchun
 * o'quvchining guruhlari aniqlanib, ikkala manba birlashtiriladi.
 */
export async function getStudentAssignments(studentId: string) {
  const memberships = await db.groupMember.findMany({
    where: { userId: studentId },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const targets = await db.assignmentTarget.findMany({
    where: {
      OR: [{ userId: studentId }, { groupId: { in: groupIds } }],
      assignment: { status: "PUBLISHED" },
    },
    orderBy: { assignedAt: "desc" },
    select: {
      dueAt: true,
      reason: true,
      assignment: {
        select: {
          id: true,
          title: true,
          type: true,
          language: true,
          difficulty: true,
          maxPoints: true,
          topic: { select: { name: true } },
          _count: { select: { testCases: true } },
        },
      },
    },
  });

  // Bir vazifa ham guruh, ham shaxsan berilgan bo'lishi mumkin — takrorlanmasin.
  // Eng erta muddat saqlanadi.
  const byId = new Map<string, (typeof targets)[number]>();
  for (const t of targets) {
    const existing = byId.get(t.assignment.id);
    if (!existing) {
      byId.set(t.assignment.id, t);
    } else if (t.dueAt && (!existing.dueAt || t.dueAt < existing.dueAt)) {
      byId.set(t.assignment.id, t);
    }
  }
  const unique = [...byId.values()];

  const submissions = await db.submission.findMany({
    where: {
      studentId,
      assignmentId: { in: unique.map((t) => t.assignment.id) },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      assignmentId: true,
      status: true,
      finalScore: true,
      autoScore: true,
      testsPassed: true,
      testsTotal: true,
      submittedAt: true,
    },
  });

  const latestByAssignment = new Map<string, (typeof submissions)[number]>();
  for (const s of submissions) {
    if (!latestByAssignment.has(s.assignmentId)) {
      latestByAssignment.set(s.assignmentId, s);
    }
  }

  return unique.map((t) => ({
    ...t.assignment,
    dueAt: t.dueAt,
    reason: t.reason,
    submission: latestByAssignment.get(t.assignment.id) ?? null,
  }));
}

/** Shu o'quvchi shu vazifaga kira oladimi? */
export async function canStudentAccess(
  studentId: string,
  assignmentId: string
): Promise<boolean> {
  const memberships = await db.groupMember.findMany({
    where: { userId: studentId },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const target = await db.assignmentTarget.findFirst({
    where: {
      assignmentId,
      assignment: { status: "PUBLISHED" },
      OR: [{ userId: studentId }, { groupId: { in: groupIds } }],
    },
    select: { id: true },
  });

  return Boolean(target);
}

/** Vazifa muddati (shu o'quvchi uchun eng erta). */
export async function getDueAt(studentId: string, assignmentId: string) {
  const memberships = await db.groupMember.findMany({
    where: { userId: studentId },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const target = await db.assignmentTarget.findFirst({
    where: {
      assignmentId,
      OR: [{ userId: studentId }, { groupId: { in: groupIds } }],
      dueAt: { not: null },
    },
    orderBy: { dueAt: "asc" },
    select: { dueAt: true },
  });

  return target?.dueAt ?? null;
}
