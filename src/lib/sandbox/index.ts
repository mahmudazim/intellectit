import { pistonRunner } from "./piston";
import { pyodideRunner } from "./pyodide";
import {
  outputsMatch,
  type CodeRunner,
  type RunResult,
  type TestCaseInput,
  type TestOutcome,
} from "./types";

export type { RunResult, TestCaseInput, TestOutcome };
export { outputsMatch };

/**
 * Backend tanlash. Standart — Pyodide (bepul, limitsiz, sozlash kerak emas).
 * O'z Piston serveringiz bo'lsa: CODE_RUNNER=piston + PISTON_URL.
 */
function pickRunner(): CodeRunner {
  return process.env.CODE_RUNNER === "piston" ? pistonRunner : pyodideRunner;
}

export const runner = pickRunner();

export async function runCode(
  language: string,
  code: string,
  stdin = ""
): Promise<RunResult> {
  return runner.run(language, code, stdin);
}

/**
 * Barcha test-case'larni ketma-ket bajaradi.
 * Infra xatosi bo'lsa darhol to'xtaydi — 10 ta test 10 marta bir xil
 * xato bermasligi kerak.
 */
export async function runTestCases(
  language: string,
  code: string,
  testCases: TestCaseInput[]
): Promise<{ outcomes: TestOutcome[]; infraError?: string }> {
  const outcomes: TestOutcome[] = [];

  for (const tc of testCases) {
    const r = await runner.run(language, code, tc.stdin);

    if (r.infraError) {
      return { outcomes, infraError: r.infraError };
    }

    outcomes.push({
      testCaseId: tc.id,
      passed:
        !r.timedOut && !r.stderr.trim() && outputsMatch(tc.expectedStdout, r.stdout),
      actualOutput: r.stdout.slice(0, 4000),
      stderr: r.timedOut
        ? "Kod juda uzoq ishladi (5 soniyadan oshdi). Cheksiz sikl bo'lishi mumkin."
        : r.stderr.trim()
          ? r.stderr.slice(0, 4000)
          : null,
      runtimeMs: r.runtimeMs,
      order: tc.order,
    });
  }

  return { outcomes };
}
