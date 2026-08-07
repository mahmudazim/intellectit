"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Cloud,
  CloudOff,
  Play,
  RotateCcw,
} from "lucide-react";

import { LazyCodeEditor } from "@/components/editor/LazyCodeEditor";
import { HtmlPreview } from "@/components/editor/HtmlPreview";
import { AiReviewPanel, type AiReviewData } from "@/components/AiReviewPanel";
import { useDraft } from "@/lib/useDraft";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type VisibleTest = {
  id: string;
  order: number;
  stdin: string | null;
  expectedStdout: string | null;
  isHidden: boolean;
};

export type LastResult = {
  testsPassed: number;
  testsTotal: number;
  autoScore: number | null;
  results: {
    testCaseId: string;
    passed: boolean;
    actualOutput: string;
    stderr: string | null;
  }[];
  ai?: AiReviewData | null;
};

type Tab = "task" | "code" | "result";

export function SolveWorkspace({
  assignmentId,
  description,
  language,
  type,
  starterCode,
  savedCode,
  tests,
  initialResult,
}: {
  assignmentId: string;
  description: string;
  language: string;
  type: string;
  starterCode: string;
  savedCode: string | null;
  tests: VisibleTest[];
  initialResult: LastResult | null;
}) {
  const router = useRouter();
  const [code, setCode] = useState(savedCode ?? starterCode);
  const [tab, setTab] = useState<Tab>("task");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LastResult | null>(initialResult);
  const [restored, setRestored] = useState(false);

  const { status, readLocal, clearLocal } = useDraft(assignmentId, code);
  const isHtml = type === "HTML_CSS";

  // Sahifa ochilganda telefonda saqlangan qoralamani tiklaymiz.
  useEffect(() => {
    const local = readLocal();
    if (local && local.code.trim() && local.code !== (savedCode ?? starterCode)) {
      setCode(local.code);
      setRestored(true);
    }
    // faqat bir marta, ochilganda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    if (submitting) return;
    setError(null);

    if (!navigator.onLine) {
      setError(
        "Internet yo'q. Kodingiz saqlandi — ulanish qaytganda qayta yuboring."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "Yuborishda xatolik. Qayta urinib ko'ring.");
        setTab("result");
        return;
      }

      clearLocal();
      setTab("result");
      router.refresh();

      const detail = await fetch(
        `/api/submissions/${data.submissionId}`
      ).then((r) => (r.ok ? r.json() : null));

      setResult(
        detail ?? {
          testsPassed: data.testsPassed ?? 0,
          testsTotal: data.testsTotal ?? 0,
          autoScore: data.autoScore ?? null,
          results: [],
        }
      );

      // AI izohi javobdan keyin tayyorlanadi — tayyor bo'lguncha kuzatamiz
      if (data.aiPending) pollAi(data.submissionId);
    } catch {
      setError("Tarmoq xatosi. Kodingiz saqlangan — qayta urinib ko'ring.");
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * AI natijasini kutish. Har 2.5 soniyada tekshiradi, 40 soniyadan keyin
   * to'xtaydi — o'quvchi cheksiz kutmasin.
   */
  function pollAi(submissionId: string) {
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      if (tries > 16) {
        clearInterval(timer);
        return;
      }
      try {
        const r = await fetch(`/api/submissions/${submissionId}`);
        if (!r.ok) return;
        const d = await r.json();
        if (d?.ai && d.ai.status !== "PENDING") {
          clearInterval(timer);
          setResult(d);
          router.refresh();
        }
      } catch {
        /* tarmoq uzildi — keyingi urinishda qayta tekshiriladi */
      }
    }, 2500);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "task", label: "Shart" },
    { id: "code", label: "Kod" },
    { id: "result", label: isHtml ? "Natija" : "Tekshiruv" },
  ];

  return (
    <div className="space-y-3">
      {/* Telefonda tab, kompyuterda uch ustun */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 lg:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "h-10 flex-1 rounded-md text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* --- Shart --- */}
        <Card className={cn(tab === "task" ? "" : "hidden", "lg:block")}>
          <CardContent className="p-4 pt-4">
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
              Vazifa sharti
            </h2>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {description}
            </div>

            {tests.filter((t) => !t.isHidden).length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Namunalar
                </h3>
                {tests
                  .filter((t) => !t.isHidden)
                  .map((t, i) => (
                    <div
                      key={t.id}
                      className="rounded-md border border-border p-2.5 text-sm"
                    >
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Namuna {i + 1}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Kirish</p>
                          <pre className="scroll-x mt-0.5 rounded bg-muted p-1.5 font-mono text-xs">
                            {t.stdin || "(bo'sh)"}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Chiqish
                          </p>
                          <pre className="scroll-x mt-0.5 rounded bg-muted p-1.5 font-mono text-xs">
                            {t.expectedStdout}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* --- Kod --- */}
        <div className={cn("space-y-2", tab === "code" ? "" : "hidden", "lg:block")}>
          {restored && (
            <div className="flex items-start gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
              <RotateCcw size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>Saqlangan kodingiz tiklandi.</span>
            </div>
          )}

          <LazyCodeEditor
            value={code}
            onChange={setCode}
            language={isHtml ? "html" : language}
            minHeight="300px"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {status === "offline" ? (
                <>
                  <CloudOff size={14} aria-hidden /> Internet yo'q
                </>
              ) : status === "saving" ? (
                <>
                  <Cloud size={14} aria-hidden /> Saqlanmoqda...
                </>
              ) : status === "saved" ? (
                <>
                  <Cloud size={14} aria-hidden /> Saqlandi
                </>
              ) : (
                <>
                  <Cloud size={14} aria-hidden /> Avtomatik saqlanadi
                </>
              )}
            </span>
          </div>
        </div>

        {/* --- Natija --- */}
        <div
          className={cn(
            "space-y-3 lg:col-span-2",
            tab === "result" ? "" : "hidden",
            "lg:block"
          )}
        >
          {isHtml ? (
            <HtmlPreview code={code} />
          ) : result ? (
            <>
              <ResultPanel result={result} tests={tests} />
              <AiReviewPanel ai={result.ai ?? null} />
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Kodni yuborganingizdan keyin tekshiruv natijasi shu yerda
                ko'rinadi.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex gap-2 rounded-md bg-danger/10 px-3 py-3 text-sm text-danger"
        >
          <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {/* Yuborish tugmasi — telefonda doim qo'l yetadigan joyda */}
      <div className="sticky bottom-16 z-20 lg:static lg:bottom-auto">
        <Button
          type="button"
          size="block"
          onClick={submit}
          disabled={submitting || !code.trim()}
          className="shadow-lg lg:shadow-none"
        >
          {submitting ? (
            "Tekshirilmoqda..."
          ) : (
            <>
              <Play aria-hidden /> Yuborish va tekshirish
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  tests,
}: {
  result: LastResult;
  tests: VisibleTest[];
}) {
  const allPassed =
    result.testsTotal > 0 && result.testsPassed === result.testsTotal;

  return (
    <Card>
      <CardContent className="space-y-3 p-4 pt-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-lg",
              allPassed
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger"
            )}
          >
            {allPassed ? (
              <CircleCheck size={22} aria-hidden />
            ) : (
              <CircleX size={22} aria-hidden />
            )}
          </div>
          <div>
            <p className="font-semibold">
              {result.testsPassed} / {result.testsTotal} test o'tdi
            </p>
            <p className="text-sm text-muted-foreground">
              Ball: {result.autoScore ?? 0}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {result.results.map((r, i) => {
            const test = tests.find((t) => t.id === r.testCaseId);
            const hidden = test?.isHidden ?? false;
            return (
              <div
                key={r.testCaseId}
                className={cn(
                  "rounded-md border p-2.5 text-sm",
                  r.passed ? "border-success/40" : "border-danger/40"
                )}
              >
                <div className="flex items-center gap-2">
                  {r.passed ? (
                    <CircleCheck size={15} className="text-success" aria-hidden />
                  ) : (
                    <CircleX size={15} className="text-danger" aria-hidden />
                  )}
                  <span className="font-medium">
                    Test {i + 1}
                    {hidden ? " (yashirin)" : ""}
                  </span>
                </div>

                {!r.passed && !hidden && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Kutilgan</p>
                      <pre className="scroll-x mt-0.5 rounded bg-muted p-1.5 font-mono text-xs">
                        {test?.expectedStdout ?? ""}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sizniki</p>
                      <pre className="scroll-x mt-0.5 rounded bg-muted p-1.5 font-mono text-xs">
                        {r.actualOutput || "(bo'sh)"}
                      </pre>
                    </div>
                  </div>
                )}

                {r.stderr && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground">Xato xabari</p>
                    <pre className="scroll-x mt-0.5 rounded bg-danger/10 p-1.5 font-mono text-xs text-danger">
                      {r.stderr}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
