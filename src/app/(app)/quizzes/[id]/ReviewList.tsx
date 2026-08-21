import { CircleCheck, CircleX } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ReviewAnswer = {
  questionId: string;
  prompt: string;
  codeSnippet: string | null;
  isCorrect: boolean | null;
  pointsEarned: number;
  maxPoints: number;
  aiFeedback: string | null;
  yourAnswer: { type?: string; value?: string; optionIds?: string[] } | null;
  options: { id: string; text: string; isCorrect: boolean }[] | null;
  correctText: string | null;
  explanation: string | null;
};

/**
 * Savol-savol tahlil — o'quvchi xatosidan o'rgansin.
 * To'g'ri javoblar faqat server ruxsat berganda keladi (showAnswersAt).
 */
export function ReviewList({
  review,
  heading,
}: {
  review: ReviewAnswer[];
  heading?: string;
}) {
  return (
    <div className="space-y-2">
      {heading && (
        <h2 className="text-sm font-medium text-muted-foreground">{heading}</h2>
      )}

      {review.map((r, i) => {
        const chosen = r.yourAnswer?.optionIds ?? [];
        const typed = r.yourAnswer?.value ?? "";
        return (
          <Card
            key={r.questionId}
            className={r.isCorrect ? "border-success/40" : "border-danger/40"}
          >
            <CardContent className="space-y-2 p-4 pt-4">
              <div className="flex items-start gap-2">
                {r.isCorrect ? (
                  <CircleCheck size={16} className="mt-0.5 shrink-0 text-success" aria-hidden />
                ) : (
                  <CircleX size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />
                )}
                <p className="min-w-0 flex-1 text-sm font-medium leading-snug">
                  {i + 1}. {r.prompt}
                </p>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {r.pointsEarned}/{r.maxPoints}
                </span>
              </div>

              {r.codeSnippet && (
                <pre className="scroll-x rounded-md bg-muted p-2.5 font-mono text-xs">
                  {r.codeSnippet}
                </pre>
              )}

              {r.options ? (
                <ul className="space-y-1 text-sm">
                  {r.options.map((o) => {
                    const picked = chosen.includes(o.id);
                    return (
                      <li
                        key={o.id}
                        className={cn(
                          "flex gap-2",
                          o.isCorrect && "font-medium text-success",
                          picked && !o.isCorrect && "text-danger line-through"
                        )}
                      >
                        <span aria-hidden>{o.isCorrect ? "✓" : picked ? "✗" : "·"}</span>
                        <span>{o.text}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Sizning javobingiz: </span>
                    <code>{typed || "(bo'sh)"}</code>
                  </p>
                  {r.correctText && !r.isCorrect && (
                    <p>
                      <span className="text-muted-foreground">To'g'ri javob: </span>
                      <code className="text-success">{r.correctText}</code>
                    </p>
                  )}
                </div>
              )}

              {r.aiFeedback && (
                <p className="rounded-md bg-primary/8 p-2.5 text-sm text-primary">
                  {r.aiFeedback}
                </p>
              )}

              {r.explanation && !r.isCorrect && (
                <p className="rounded-md bg-muted p-2.5 text-sm">
                  {r.explanation}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
