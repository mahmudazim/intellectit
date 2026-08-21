"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock,
  Send,
} from "lucide-react";

import type { StudentAnswer } from "@/lib/quiz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ReviewList, type ReviewAnswer } from "./ReviewList";

export type RunnerQuestion = {
  id: string;
  type:
    | "MCQ_SINGLE"
    | "MCQ_MULTI"
    | "TRUE_FALSE"
    | "SHORT_ANSWER"
    | "CODE_OUTPUT"
    | "FILL_BLANK";
  prompt: string;
  codeSnippet: string | null;
  points: number;
  /** isCorrect maydoni ATAYLAB olib tashlangan */
  options: { id: string; text: string }[] | null;
};

type Result = {
  attemptId: string;
  score: number;
  maxScore: number;
  percent: number;
  aiPending: boolean;
};

export function QuizRunner({
  quizId,
  title,
  questions,
  timeLimitMin,
}: {
  quizId: string;
  title: string;
  questions: RunnerQuestion[];
  timeLimitMin: number | null;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [review, setReview] = useState<ReviewAnswer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(
    timeLimitMin ? timeLimitMin * 60 : null
  );

  const startedAt = useRef(Date.now());
  const questionStart = useRef(Date.now());
  const timeSpent = useRef<Record<string, number>>({});
  const submitted = useRef(false);

  const current = questions[index];
  const answeredCount = Object.keys(answers).length;
  const isLast = index === questions.length - 1;

  const submit = useCallback(
    async (auto = false) => {
      if (submitted.current) return;
      submitted.current = true;
      setSubmitting(true);
      setError(null);

      // Joriy savolda o'tkazilgan vaqtni ham yozamiz
      if (current) {
        timeSpent.current[current.id] =
          (timeSpent.current[current.id] ?? 0) +
          Math.round((Date.now() - questionStart.current) / 1000);
      }

      try {
        const res = await fetch("/api/quiz-attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quizId,
            answers,
            timeSpent: timeSpent.current,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data?.error ?? "Yuborishda xatolik.");
          submitted.current = false;
          return;
        }
        setResult(data);
        router.refresh();

        // Tahlilni yuklaymiz. AI qisqa javoblarni baholayotgan bo'lsa
        // biroz kutamiz — ball o'zgarishi mumkin.
        const loadReview = async () => {
          const r = await fetch(`/api/quiz-attempts/${data.attemptId}`);
          if (!r.ok) return;
          const d = await r.json();
          setReview(d.answers as ReviewAnswer[]);
          setResult((prev) =>
            prev
              ? {
                  ...prev,
                  score: d.score,
                  percent:
                    d.maxScore > 0 ? Math.round((d.score / d.maxScore) * 100) : 0,
                }
              : prev
          );
        };
        await loadReview();
        if (data.aiPending) setTimeout(loadReview, 6000);
      } catch {
        setError(
          auto
            ? "Vaqt tugadi, lekin internet yo'q. Ulanish qaytganda qayta yuboring."
            : "Tarmoq xatosi. Qayta urinib ko'ring."
        );
        submitted.current = false;
      } finally {
        setSubmitting(false);
      }
    },
    [answers, current, quizId, router]
  );

  // Taymer
  useEffect(() => {
    if (secondsLeft === null || result) return;
    if (secondsLeft <= 0) {
      void submit(true);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, result, submit]);

  function goto(next: number) {
    if (current) {
      timeSpent.current[current.id] =
        (timeSpent.current[current.id] ?? 0) +
        Math.round((Date.now() - questionStart.current) / 1000);
    }
    questionStart.current = Date.now();
    setIndex(Math.max(0, Math.min(questions.length - 1, next)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setChoice(optionId: string, multi: boolean) {
    setAnswers((prev) => {
      const cur = prev[current.id];
      const ids = cur?.type === "choice" ? cur.optionIds : [];
      const next = multi
        ? ids.includes(optionId)
          ? ids.filter((x) => x !== optionId)
          : [...ids, optionId]
        : [optionId];
      return { ...prev, [current.id]: { type: "choice", optionIds: next } };
    });
  }

  function setText(value: string) {
    setAnswers((prev) => ({ ...prev, [current.id]: { type: "text", value } }));
  }

  const timeLabel = useMemo(() => {
    if (secondsLeft === null) return null;
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [secondsLeft]);

  // ---------- Natija ----------
  if (result) {
    const good = result.percent >= 60;
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-5 text-center">
            <div
              className={cn(
                "mx-auto flex size-14 items-center justify-center rounded-2xl",
                good ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
              )}
            >
              {good ? (
                <CircleCheck size={28} aria-hidden />
              ) : (
                <CircleX size={28} aria-hidden />
              )}
            </div>

            <div>
              <p className="text-3xl font-bold">{result.percent}%</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.score} / {result.maxScore} ball
              </p>
            </div>

            {result.aiPending && !review?.some((r) => r.aiFeedback) && (
              <p className="text-sm text-muted-foreground">
                Qisqa javoblaringiz tekshirilmoqda — ball biroz oshishi mumkin.
              </p>
            )}

            <Button size="block" onClick={() => router.push("/quizzes")}>
              Testlarga qaytish
            </Button>
          </CardContent>
        </Card>

        {review && <ReviewList review={review} heading="Javoblaringiz tahlili" />}
      </div>
    );
  }

  // ---------- Savol ----------
  const answer = answers[current.id];
  const isMulti = current.type === "MCQ_MULTI";
  const isChoice =
    current.type === "MCQ_SINGLE" ||
    current.type === "MCQ_MULTI" ||
    current.type === "TRUE_FALSE";

  return (
    <div className="space-y-4">
      {/* Yuqori qator: progress + taymer */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">
          {index + 1} / {questions.length}
        </span>
        {timeLabel && (
          <Badge variant={secondsLeft! < 60 ? "danger" : "neutral"}>
            <Clock size={12} aria-hidden /> {timeLabel}
          </Badge>
        )}
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Telefonda bitta savol = bitta ekran */}
      <Card>
        <CardContent className="space-y-4 p-4 pt-4">
          <p className="whitespace-pre-wrap font-medium leading-relaxed">
            {current.prompt}
          </p>

          {current.codeSnippet && (
            <pre className="scroll-x rounded-md bg-muted p-3 font-mono text-sm">
              {current.codeSnippet}
            </pre>
          )}

          {isChoice && current.options && (
            <div className="space-y-2">
              {isMulti && (
                <p className="text-xs text-muted-foreground">
                  Bir nechta javobni tanlash mumkin
                </p>
              )}
              {current.options.map((opt) => {
                const selected =
                  answer?.type === "choice" && answer.optionIds.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setChoice(opt.id, isMulti)}
                    aria-pressed={selected}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-md border p-3 text-left text-sm transition-colors",
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center border",
                        isMulti ? "rounded" : "rounded-full",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {selected && <CircleCheck size={13} aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          )}

          {!isChoice && (
            <div className="space-y-1.5">
              {current.type === "SHORT_ANSWER" ? (
                <Textarea
                  rows={3}
                  placeholder="Javobingizni yozing..."
                  value={answer?.type === "text" ? answer.value : ""}
                  onChange={(e) => setText(e.target.value)}
                  autoCapitalize="off"
                />
              ) : (
                <Input
                  placeholder={
                    current.type === "CODE_OUTPUT"
                      ? "Kod nima chiqaradi?"
                      : "Javobni yozing"
                  }
                  className="font-mono"
                  value={answer?.type === "text" ? answer.value : ""}
                  onChange={(e) => setText(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Navigatsiya — barmoq yetadigan joyda */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => goto(index - 1)}
          disabled={index === 0}
          aria-label="Oldingi savol"
          className="shrink-0"
        >
          <ChevronLeft aria-hidden />
        </Button>

        {isLast ? (
          <Button
            type="button"
            size="lg"
            className="flex-1"
            onClick={() => submit(false)}
            disabled={submitting}
          >
            {submitting ? (
              "Yuborilmoqda..."
            ) : (
              <>
                <Send aria-hidden /> Tugatish ({answeredCount}/{questions.length})
              </>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="flex-1"
            onClick={() => goto(index + 1)}
          >
            Keyingi <ChevronRight aria-hidden />
          </Button>
        )}
      </div>

      {/* Savollar bo'yicha tez o'tish */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            onClick={() => goto(i)}
            aria-label={`${i + 1}-savol`}
            className={cn(
              "size-9 rounded-md border text-sm font-medium",
              i === index
                ? "border-primary bg-primary text-primary-foreground"
                : answers[q.id]
                  ? "border-success/50 bg-success/10 text-success"
                  : "border-border text-muted-foreground"
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
