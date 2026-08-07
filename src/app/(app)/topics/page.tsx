import { requireTeacher } from "@/lib/guards";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Mavzular" };

const TRACK_LABEL: Record<string, string> = {
  PYTHON: "Python",
  HTML_CSS: "HTML / CSS",
  JAVASCRIPT: "JavaScript",
  WEB: "Web",
  AI: "AI",
  CYBER: "Kiberxavfsizlik",
};

function difficultyVariant(d: number) {
  if (d <= 1) return "success" as const;
  if (d <= 2) return "default" as const;
  if (d <= 3) return "warning" as const;
  return "danger" as const;
}

export default async function TopicsPage() {
  await requireTeacher();

  const modules = await db.module.findMany({
    orderBy: { order: "asc" },
    include: { topics: { orderBy: { order: "asc" } } },
  });

  const totalTopics = modules.reduce((n, m) => n + m.topics.length, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">Mavzular</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {modules.length} ta modul, {totalTopics} ta mavzu. Vazifalar va testlar
          shu mavzularga bog'lanadi — o'quvchining kuchli/zaif tomoni ham shu
          bo'yicha hisoblanadi.
        </p>
      </div>

      <div className="space-y-4">
        {modules.map((mod) => (
          <Card key={mod.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{mod.name}</CardTitle>
                <Badge variant="neutral">
                  {TRACK_LABEL[mod.track] ?? mod.track}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {mod.topics.map((topic) => (
                <div
                  key={topic.id}
                  className="rounded-md border border-border p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium leading-snug">{topic.name}</p>
                    <Badge variant={difficultyVariant(topic.difficulty)}>
                      {topic.difficulty}-daraja
                    </Badge>
                  </div>
                  {topic.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {topic.description}
                    </p>
                  )}
                  {topic.prereqSlugs.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Oldin bilish kerak: {topic.prereqSlugs.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
