import Link from "next/link";
import { ChartColumn, TriangleAlert } from "lucide-react";

import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import { getClassTopicStats } from "@/lib/mastery/weakTopics";
import { getCommonErrors } from "@/lib/mastery/commonErrors";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata = { title: "Hisobotlar" };

/** Ball → rang. Heatmap uchun. */
function cellColor(score: number | null) {
  if (score === null) return "bg-muted";
  if (score >= 0.8) return "bg-success";
  if (score >= 0.6) return "bg-primary";
  if (score >= 0.4) return "bg-warning";
  return "bg-danger";
}

const SEVERITY_LABEL: Record<string, { label: string; variant: "danger" | "warning" | "default" }> = {
  critical: { label: "Jiddiy", variant: "danger" },
  major: { label: "Muhim", variant: "warning" },
  minor: { label: "Kichik", variant: "default" },
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireTeacher();

  const params = await searchParams;
  const groupId = typeof params.group === "string" ? params.group : undefined;

  const [groups, stats, errors] = await Promise.all([
    db.group.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getClassTopicStats(groupId),
    getCommonErrors(groupId),
  ]);

  const weakest = [...stats.topics]
    .filter((t) => t.avgScore !== null)
    .sort((a, b) => (a.avgScore ?? 1) - (b.avgScore ?? 1))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          Hisobotlar
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sinf qaysi mavzularda qiynalmoqda va nimani qayta tushuntirish kerak.
        </p>
      </div>

      {/* Guruh filtri */}
      <div className="scroll-x flex gap-2 pb-1">
        <Link
          href="/reports"
          className={cn(
            "flex h-11 shrink-0 items-center rounded-md border px-3 text-sm",
            !groupId ? "border-primary bg-primary/10 text-primary" : "border-border"
          )}
        >
          Barchasi
        </Link>
        {groups.map((g) => (
          <Link
            key={g.id}
            href={`/reports?group=${g.id}`}
            className={cn(
              "flex h-11 shrink-0 items-center rounded-md border px-3 text-sm",
              groupId === g.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border"
            )}
          >
            {g.name}
          </Link>
        ))}
      </div>

      {stats.topics.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <ChartColumn size={28} className="text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Hali ma'lumot yo'q. O'quvchilar vazifa va test bajargandan keyin
              tahlil shu yerda paydo bo'ladi.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Eng zaif mavzular */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Sinf eng qiynalayotgan mavzular</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {weakest.map((t) => {
                const percent = Math.round((t.avgScore ?? 0) * 100);
                return (
                  <div key={t.topicId} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {t.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t.weakCount}/{t.measuredCount} o'quvchi zaif
                      </span>
                      <span className="w-10 shrink-0 text-right text-sm font-semibold">
                        {percent}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full", cellColor(t.avgScore))}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Eng ko'p uchraydigan xatolar */}
          {errors.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TriangleAlert size={17} className="text-warning" aria-hidden />
                  <CardTitle>Eng ko'p uchraydigan xatolar</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {errors.slice(0, 6).map((e) => {
                  const sev = SEVERITY_LABEL[e.severity] ?? SEVERITY_LABEL.minor;
                  return (
                    <details
                      key={`${e.topicSlug}-${e.severity}`}
                      className="rounded-md border border-border"
                    >
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-3">
                        <Badge variant={sev.variant}>{sev.label}</Badge>
                        <span className="min-w-0 flex-1 text-sm font-medium">
                          {e.topicName}
                        </span>
                        <span className="shrink-0 text-sm text-muted-foreground">
                          {e.studentCount} o'quvchi
                        </span>
                      </summary>
                      <ul className="space-y-1.5 border-t border-border p-3 text-sm text-muted-foreground">
                        {e.examples.map((ex, i) => (
                          <li key={i}>· {ex}</li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
                <p className="text-xs text-muted-foreground">
                  Bu ro'yxat AI baholashidan yig'iladi. Ko'p uchragan xatoni
                  keyingi darsda qayta tushuntirish foydali bo'ladi.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Heatmap — kim qaysi mavzuda */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Mavzular xaritasi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="scroll-x">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-card p-1 text-left font-medium">
                        Mavzu
                      </th>
                      {stats.students.map((s) => (
                        <th
                          key={s.id}
                          className="p-1 text-center text-xs font-normal text-muted-foreground"
                          title={s.fullName}
                        >
                          {s.fullName
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topics.map((t) => (
                      <tr key={t.topicId}>
                        <td className="sticky left-0 z-10 max-w-[9rem] truncate bg-card py-1 pr-2 text-xs">
                          {t.name}
                        </td>
                        {t.perStudent.map((p) => (
                          <td key={p.userId} className="p-0.5">
                            <div
                              className={cn(
                                "size-6 rounded",
                                cellColor(p.score),
                                p.lowConfidence && "opacity-50"
                              )}
                              title={
                                p.score === null
                                  ? "Ma'lumot yo'q"
                                  : p.lowConfidence
                                    ? `${Math.round(p.score * 100)}% (kam dalil — 1 urinish)`
                                    : `${Math.round(p.score * 100)}%`
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="size-3 rounded bg-success" /> mustahkam
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-3 rounded bg-primary" /> yaxshi
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-3 rounded bg-warning" /> o'rtacha
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-3 rounded bg-danger" /> zaif
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-3 rounded bg-muted" /> ma'lumot yo'q
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
