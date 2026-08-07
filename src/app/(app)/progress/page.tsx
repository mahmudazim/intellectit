import Link from "next/link";
import { CircleHelp, Target, TrendingUp, TriangleAlert } from "lucide-react";

import { requireStudent } from "@/lib/guards";
import { getTopicStates, type TopicState } from "@/lib/mastery/weakTopics";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata = { title: "Rivojlanish" };

const STATUS_STYLE: Record<
  TopicState["status"],
  { label: string; bar: string; text: string }
> = {
  strong: { label: "Mustahkam", bar: "bg-success", text: "text-success" },
  ok: { label: "Yaxshi", bar: "bg-primary", text: "text-primary" },
  weak: { label: "Takrorlash kerak", bar: "bg-danger", text: "text-danger" },
  unknown: { label: "Aniqlanmagan", bar: "bg-muted-foreground/30", text: "text-muted-foreground" },
};

function TopicRow({ topic }: { topic: TopicState }) {
  const style = STATUS_STYLE[topic.status];
  const percent = Math.round(topic.score * 100);

  return (
    <div className="space-y-1.5 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-sm">{topic.name}</span>
        <span className={cn("shrink-0 text-xs font-medium", style.text)}>
          {topic.status === "unknown" ? "—" : `${percent}%`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all", style.bar)}
          style={{ width: topic.status === "unknown" ? "100%" : `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default async function ProgressPage() {
  const user = await requireStudent();
  const states = await getTopicStates(user.id);

  const measured = states.filter((s) => s.status !== "unknown");
  const weak = states
    .filter((s) => s.status === "weak")
    .sort((a, b) => {
      if (!a.blockedBy && b.blockedBy) return -1;
      if (a.blockedBy && !b.blockedBy) return 1;
      return b.priority - a.priority;
    });
  const strong = states.filter((s) => s.status === "strong");

  // Modul bo'yicha guruhlash
  const byModule = states.reduce<Record<string, TopicState[]>>((acc, s) => {
    (acc[s.moduleName] ??= []).push(s);
    return acc;
  }, {});

  const overall =
    measured.length > 0
      ? Math.round(
          (measured.reduce((sum, s) => sum + s.score, 0) / measured.length) * 100
        )
      : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          Rivojlanish
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Qaysi mavzular mustahkam, qaysilarini takrorlash kerak.
        </p>
      </div>

      {measured.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <CircleHelp size={28} className="text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Hali yetarli ma'lumot yo'q. Bir nechta vazifa va test bajaring —
              keyin bu yerda kuchli va zaif tomonlaringiz ko'rinadi.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Umumiy holat */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="flex flex-col items-center gap-1 p-3 pt-3">
                <TrendingUp size={18} className="text-primary" aria-hidden />
                <span className="text-lg font-bold leading-none">{overall}%</span>
                <span className="text-[11px] text-muted-foreground">
                  O'rtacha
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center gap-1 p-3 pt-3">
                <Target size={18} className="text-success" aria-hidden />
                <span className="text-lg font-bold leading-none">
                  {strong.length}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Mustahkam
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center gap-1 p-3 pt-3">
                <TriangleAlert size={18} className="text-danger" aria-hidden />
                <span className="text-lg font-bold leading-none">
                  {weak.length}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Takrorlash
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Nimani mustahkamlash kerak */}
          {weak.length > 0 && (
            <Card className="border-danger/30">
              <CardHeader className="pb-2">
                <CardTitle>Nimani mustahkamlash kerak</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {weak.slice(0, 4).map((t, i) => (
                  <div
                    key={t.topicId}
                    className="rounded-md border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-snug">
                        {i === 0 && !t.blockedBy && (
                          <Badge variant="danger" className="mr-2">
                            Avval shu
                          </Badge>
                        )}
                        {t.name}
                      </p>
                      <span className="shrink-0 text-sm font-semibold text-danger">
                        {Math.round(t.score * 100)}%
                      </span>
                    </div>

                    {t.blockedBy && (
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        Avval <strong>{t.blockedBy}</strong> mavzusini
                        mustahkamlang — bu mavzu unga tayanadi.
                      </p>
                    )}
                  </div>
                ))}

                <p className="text-sm text-muted-foreground">
                  O'qituvchi shu mavzular bo'yicha qo'shimcha vazifa berishi
                  mumkin.
                </p>
              </CardContent>
            </Card>
          )}

          {/* To'liq xarita */}
          <div className="space-y-4">
            {Object.entries(byModule).map(([moduleName, list]) => {
              const done = list.filter((s) => s.status !== "unknown").length;
              return (
                <Card key={moduleName}>
                  <CardHeader className="pb-1">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>{moduleName}</CardTitle>
                      <span className="text-xs text-muted-foreground">
                        {done}/{list.length}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="divide-y divide-border">
                    {list.map((t) => (
                      <TopicRow key={t.topicId} topic={t} />
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="pb-2 text-center text-xs text-muted-foreground">
            Baho vazifa va test natijalaringizdan hisoblanadi. Uzoq mashq
            qilinmagan mavzu bahosi sekin pasayadi.
          </p>
        </>
      )}

      <Link
        href="/assignments"
        className="flex h-11 items-center justify-center text-sm text-primary"
      >
        Vazifalarga o'tish →
      </Link>
    </div>
  );
}
