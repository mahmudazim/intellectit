import { db } from "@/lib/db";
import { generateAssignmentForTopic } from "@/lib/ai/generateAssignment";
import { getWeakTopics, type TopicState } from "./weakTopics";

/**
 * Zaif mavzular bo'yicha avtomatik mashq berish.
 *
 * Oqim:
 *   1. O'quvchining zaif mavzularini top (ildizdan boshlab)
 *   2. Vazifalar bankidan mos qiyinlikdagi, hali berilmagan vazifani tanla
 *   3. Bank bo'sh bo'lsa → AI yangi vazifa yaratadi (o'qituvchi tasdiqlaydi)
 *   4. Kuniga maksimum 2 ta — o'quvchini bosmaslik uchun
 */

/** Kuniga bitta o'quvchiga beriladigan maksimal mashq soni */
const MAX_PER_DAY = 2;

/**
 * O'quvchining darajasiga mos qiyinlik.
 * Juda qiyin vazifa zaif o'quvchini butunlay to'xtatadi.
 */
function targetDifficulty(score: number): number {
  // score 0.0 → 1-daraja, 0.6 → 3-daraja
  return Math.max(1, Math.min(5, Math.round(1 + score * 4)));
}

export type PracticeResult = {
  studentId: string;
  studentName: string;
  assigned: { assignmentId: string; title: string; topicName: string }[];
  generated: number;
  skipped: string[];
};

async function alreadyAssignedIds(studentId: string): Promise<Set<string>> {
  const memberships = await db.groupMember.findMany({
    where: { userId: studentId },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const targets = await db.assignmentTarget.findMany({
    where: { OR: [{ userId: studentId }, { groupId: { in: groupIds } }] },
    select: { assignmentId: true },
  });
  return new Set(targets.map((t) => t.assignmentId));
}

/** Bugun shu o'quvchiga nechta avtomatik mashq berilgan. */
async function assignedTodayCount(studentId: string): Promise<number> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  return db.assignmentTarget.count({
    where: {
      userId: studentId,
      assignedAt: { gte: since },
      reason: { not: null },
    },
  });
}

/**
 * Bitta o'quvchiga mashq beradi.
 * `allowGeneration` — bank bo'sh bo'lsa AI yangi vazifa yaratsinmi.
 */
export async function assignPracticeFor(
  studentId: string,
  options: { allowGeneration?: boolean; teacherId?: string } = {}
): Promise<PracticeResult> {
  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { id: true, fullName: true },
  });
  const result: PracticeResult = {
    studentId,
    studentName: student?.fullName ?? "?",
    assigned: [],
    generated: 0,
    skipped: [],
  };
  if (!student) return result;

  const todayCount = await assignedTodayCount(studentId);
  const budget = MAX_PER_DAY - todayCount;
  if (budget <= 0) {
    result.skipped.push("Bugungi mashq chegarasi to'lgan");
    return result;
  }

  const weak = await getWeakTopics(studentId, 5);
  if (weak.length === 0) {
    result.skipped.push("Zaif mavzu topilmadi");
    return result;
  }

  const taken = await alreadyAssignedIds(studentId);
  const teacherId =
    options.teacherId ??
    (await db.user.findFirst({ where: { role: "TEACHER" }, select: { id: true } }))
      ?.id;

  for (const topic of weak) {
    if (result.assigned.length >= budget) break;

    const wanted = targetDifficulty(topic.score);

    // Bankdan mos vazifa: hali berilmagan, qiyinlik bo'yicha eng yaqini
    const candidates = await db.assignment.findMany({
      where: {
        topicId: topic.topicId,
        status: "PUBLISHED",
        type: "CODE",
        id: { notIn: [...taken] },
      },
      select: { id: true, title: true, difficulty: true },
    });

    const best = candidates.sort(
      (a, b) =>
        Math.abs(a.difficulty - wanted) - Math.abs(b.difficulty - wanted)
    )[0];

    if (best) {
      await db.assignmentTarget.create({
        data: {
          assignmentId: best.id,
          userId: studentId,
          reason: `Zaif mavzu: ${topic.name}`,
          // Mashq uchun bir hafta
          dueAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        },
      });
      taken.add(best.id);
      result.assigned.push({
        assignmentId: best.id,
        title: best.title,
        topicName: topic.name,
      });
      continue;
    }

    // Bank bo'sh — AI yangi vazifa yaratadi
    if (!options.allowGeneration || !teacherId) {
      result.skipped.push(`${topic.name}: bankda mos vazifa yo'q`);
      continue;
    }

    const gen = await generateAssignmentForTopic(topic.topicId, wanted, teacherId);
    if (gen.ok) {
      result.generated += 1;
      // Vazifa PENDING_REVIEW — o'qituvchi tasdiqlagach beriladi.
      // Shu sababli hozir target yaratmaymiz.
      result.skipped.push(
        `${topic.name}: yangi vazifa yaratildi, tasdiqlash kutilmoqda`
      );
    } else {
      result.skipped.push(`${topic.name}: ${gen.error}`);
    }
  }

  return result;
}

/**
 * Barcha faol o'quvchilar uchun ishlaydi (cron).
 *
 * AI generatsiyasi qimmat — shuning uchun bir yugurishda cheklangan
 * miqdorda vazifa yaratiladi.
 */
export async function assignPracticeForAll(
  maxGenerations = 3
): Promise<{ results: PracticeResult[]; totalAssigned: number }> {
  const students = await db.user.findMany({
    where: { role: "STUDENT", isActive: true },
    select: { id: true },
  });

  const teacher = await db.user.findFirst({
    where: { role: "TEACHER" },
    select: { id: true },
  });

  const results: PracticeResult[] = [];
  let generationsLeft = maxGenerations;

  for (const s of students) {
    const r = await assignPracticeFor(s.id, {
      allowGeneration: generationsLeft > 0,
      teacherId: teacher?.id,
    });
    generationsLeft -= r.generated;
    if (r.assigned.length > 0 || r.generated > 0) results.push(r);
  }

  return {
    results,
    totalAssigned: results.reduce((n, r) => n + r.assigned.length, 0),
  };
}

/** O'qituvchi uchun: kim nimadan qiynalmoqda va nima taklif qilinadi. */
export async function getPracticeSuggestions(limit = 10) {
  const students = await db.user.findMany({
    where: { role: "STUDENT", isActive: true },
    select: { id: true, fullName: true },
  });

  const rows: {
    studentId: string;
    studentName: string;
    weak: TopicState[];
  }[] = [];

  for (const s of students) {
    const weak = await getWeakTopics(s.id, 3);
    if (weak.length > 0) {
      rows.push({ studentId: s.id, studentName: s.fullName, weak });
    }
  }

  return rows
    .sort((a, b) => (b.weak[0]?.priority ?? 0) - (a.weak[0]?.priority ?? 0))
    .slice(0, limit);
}
