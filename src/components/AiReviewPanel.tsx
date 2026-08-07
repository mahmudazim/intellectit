"use client";

import { useState } from "react";
import {
  ChevronDown,
  CircleAlert,
  Lightbulb,
  Sparkles,
  ThumbsUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AiIssue = {
  line: number | null;
  topicSlug: string;
  severity: "critical" | "major" | "minor" | "style";
  explanation: string;
  hint: string;
};

export type AiReviewData = {
  status: "PENDING" | "DONE" | "FAILED" | "SKIPPED";
  summary: string | null;
  strengths: string[] | null;
  issues: AiIssue[] | null;
  codeQuality: number | null;
};

const SEVERITY: Record<
  AiIssue["severity"],
  { label: string; variant: "danger" | "warning" | "default" | "neutral" }
> = {
  critical: { label: "Jiddiy", variant: "danger" },
  major: { label: "Muhim", variant: "warning" },
  minor: { label: "Kichik", variant: "default" },
  style: { label: "Uslub", variant: "neutral" },
};

/**
 * AI izohi.
 *
 * Telefonda avval faqat xulosa ko'rinadi — batafsil xatolar yig'ilgan
 * holatda. Uzun matn telefonda o'qilmaydi.
 */
export function AiReviewPanel({ ai }: { ai: AiReviewData | null }) {
  const [openIssue, setOpenIssue] = useState<number | null>(0);

  if (!ai) return null;

  if (ai.status === "PENDING") {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-4 pt-4">
          <Sparkles size={18} className="animate-pulse text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">
            AI kodingizni o'qimoqda... bir necha soniya kuting.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (ai.status === "SKIPPED" || ai.status === "FAILED") {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 p-4 pt-4">
          <CircleAlert size={18} className="mt-0.5 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            AI izohi hozircha tayyor emas. Test natijangiz saqlangan — ball
            o'zgarmaydi.
          </p>
        </CardContent>
      </Card>
    );
  }

  const strengths = ai.strengths ?? [];
  const issues = ai.issues ?? [];

  return (
    <Card>
      <CardContent className="space-y-4 p-4 pt-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles size={17} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">AI izohi</p>
            {ai.summary && (
              <p className="mt-1 text-sm leading-relaxed">{ai.summary}</p>
            )}
          </div>
          {ai.codeQuality !== null && (
            <Badge variant="neutral" className="shrink-0">
              Kod sifati {ai.codeQuality}
            </Badge>
          )}
        </div>

        {strengths.length > 0 && (
          <div className="rounded-md bg-success/8 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-success">
              <ThumbsUp size={14} aria-hidden /> Yaxshi tomonlari
            </p>
            <ul className="space-y-1 text-sm">
              {strengths.map((s, i) => (
                <li key={i} className="flex gap-1.5">
                  <span aria-hidden>·</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {issues.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Ustida ishlash kerak
            </p>
            {issues.map((issue, i) => {
              const sev = SEVERITY[issue.severity] ?? SEVERITY.minor;
              const open = openIssue === i;
              return (
                <div key={i} className="rounded-md border border-border">
                  <button
                    type="button"
                    onClick={() => setOpenIssue(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-2 p-3 text-left"
                  >
                    <Badge variant={sev.variant}>{sev.label}</Badge>
                    {issue.line !== null && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {issue.line}-qator
                      </span>
                    )}
                    {/* Ochilganda sarlavhadagi qisqartma umuman chizilmaydi —
                        pastda to'liq matn bor, takrorlanmasin */}
                    {open ? (
                      <span className="flex-1" />
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {issue.explanation}
                      </span>
                    )}
                    <ChevronDown
                      size={16}
                      aria-hidden
                      className={cn(
                        "shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-180"
                      )}
                    />
                  </button>

                  {open && (
                    <div className="space-y-2 border-t border-border p-3">
                      <p className="text-sm leading-relaxed">
                        {issue.explanation}
                      </p>
                      {issue.hint && (
                        <p className="flex gap-2 rounded-md bg-primary/8 p-2.5 text-sm text-primary">
                          <Lightbulb size={15} className="mt-0.5 shrink-0" aria-hidden />
                          <span>{issue.hint}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
