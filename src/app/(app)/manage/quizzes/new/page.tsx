import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import { QUESTION_TYPE_LABEL } from "@/lib/quiz";
import { QuizForm } from "./QuizForm";

export const metadata = { title: "Yangi test" };

export default async function NewQuizPage() {
  await requireTeacher();

  const [questions, groups, students] = await Promise.all([
    db.question.findMany({
      where: { isApproved: true },
      orderBy: [{ topicId: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        prompt: true,
        type: true,
        difficulty: true,
        topic: { select: { name: true } },
      },
    }),
    db.group.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.user.findMany({
      where: { role: "STUDENT", isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <Link
        href="/manage/quizzes"
        className="inline-flex h-11 items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft size={16} aria-hidden /> Testlar
      </Link>

      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          Yangi test
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Savollar bankidan tanlang. Aralashtirish yoqilgan bo'lsa har bir
          o'quvchi savollarni boshqa tartibda ko'radi.
        </p>
      </div>

      <QuizForm
        questions={questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          typeLabel: QUESTION_TYPE_LABEL[q.type],
          topicName: q.topic.name,
          difficulty: q.difficulty,
        }))}
        groups={groups}
        students={students}
      />
    </div>
  );
}
