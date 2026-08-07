import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import { AssignmentForm } from "./AssignmentForm";

export const metadata = { title: "Yangi vazifa" };

export default async function NewAssignmentPage() {
  await requireTeacher();

  const [modules, groups, students] = await Promise.all([
    db.module.findMany({
      orderBy: { order: "asc" },
      select: {
        name: true,
        topics: {
          orderBy: { order: "asc" },
          select: { id: true, name: true, difficulty: true },
        },
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

  const topics = modules.flatMap((m) =>
    m.topics.map((t) => ({ ...t, moduleName: m.name }))
  );

  return (
    <div className="space-y-4">
      <Link
        href="/manage/assignments"
        className="inline-flex h-11 items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft size={16} aria-hidden /> Vazifalar
      </Link>

      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          Yangi vazifa
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Yechim test-case'larda avtomatik tekshiriladi — buzuq vazifa
          o'quvchiga bermaydi.
        </p>
      </div>

      <AssignmentForm topics={topics} groups={groups} students={students} />
    </div>
  );
}
