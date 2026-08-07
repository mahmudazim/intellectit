import { db } from "@/lib/db";

/**
 * Sinfda eng ko'p uchraydigan xatolar.
 *
 * Manba — AI baholashdagi `issues` massivi. Bu o'qituvchiga
 * "12 o'quvchi range() chegarasida adashdi" kabi xulosa beradi,
 * ya'ni keyingi darsda nimani tushuntirish kerakligini ko'rsatadi.
 */

export type CommonError = {
  topicSlug: string;
  topicName: string;
  severity: string;
  /** Nechta o'quvchida uchradi (bir o'quvchi bir marta sanaladi) */
  studentCount: number;
  /** Umumiy uchrash soni */
  totalCount: number;
  /** Namuna izohlar — o'qituvchi kontekstni tushunishi uchun */
  examples: string[];
};

export async function getCommonErrors(
  groupId?: string,
  sinceDays = 30
): Promise<CommonError[]> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  const reviews = await db.aiReview.findMany({
    where: {
      status: "DONE",
      createdAt: { gte: since },
      submission: {
        student: {
          role: "STUDENT",
          ...(groupId ? { groups: { some: { groupId } } } : {}),
        },
      },
    },
    select: {
      issues: true,
      submission: { select: { studentId: true } },
    },
    take: 1000,
  });

  type Bucket = {
    severity: string;
    students: Set<string>;
    total: number;
    examples: string[];
  };
  const buckets = new Map<string, Bucket>();

  for (const r of reviews) {
    const issues = (r.issues ?? []) as {
      topicSlug: string;
      severity: string;
      explanation: string;
    }[];
    if (!Array.isArray(issues)) continue;

    for (const issue of issues) {
      // Faqat mazmunli xatolar — uslub xatolari ko'p va kam ahamiyatli
      if (issue.severity === "style") continue;

      const key = `${issue.topicSlug}:${issue.severity}`;
      const b = buckets.get(key) ?? {
        severity: issue.severity,
        students: new Set<string>(),
        total: 0,
        examples: [],
      };
      b.students.add(r.submission.studentId);
      b.total += 1;
      if (b.examples.length < 3 && issue.explanation) {
        b.examples.push(issue.explanation.slice(0, 160));
      }
      buckets.set(key, b);
    }
  }

  const slugs = [...new Set([...buckets.keys()].map((k) => k.split(":")[0]))];
  const topics = await db.topic.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, name: true },
  });
  const nameBySlug = new Map(topics.map((t) => [t.slug, t.name]));

  return [...buckets.entries()]
    .map(([key, b]) => {
      const slug = key.split(":")[0];
      return {
        topicSlug: slug,
        topicName: nameBySlug.get(slug) ?? slug,
        severity: b.severity,
        studentCount: b.students.size,
        totalCount: b.total,
        examples: b.examples,
      };
    })
    // Ko'p o'quvchida uchragan va jiddiyroq xatolar yuqorida
    .sort((a, b) => {
      const rank = { critical: 2, major: 1, minor: 0 } as Record<string, number>;
      const diff = b.studentCount - a.studentCount;
      if (diff !== 0) return diff;
      return (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0);
    })
    .slice(0, 12);
}
