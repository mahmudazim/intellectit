import { Hammer } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * Hali qurilmagan bo'limlar uchun. Navigatsiyadagi har bir havola ishlashi
 * kerak — 404 chiqmasligi lozim.
 */
export function Placeholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Hammer size={22} aria-hidden />
          </div>
          <p className="text-sm font-medium">Bu bo'lim hali qurilmoqda</p>
          <p className="max-w-sm text-sm text-muted-foreground">{phase}</p>
        </CardContent>
      </Card>
    </div>
  );
}
