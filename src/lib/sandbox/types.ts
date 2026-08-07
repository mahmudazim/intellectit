export type RunResult = {
  stdout: string;
  stderr: string;
  /** Vaqt chegarasidan oshdi (cheksiz sikl va h.k.) */
  timedOut: boolean;
  runtimeMs: number;
  /** Sandbox'ning o'zi ishlamadi — o'quvchi kodi aybdor emas */
  infraError?: string;
};

export type TestCaseInput = {
  id: string;
  stdin: string;
  expectedStdout: string;
  points: number;
  order: number;
};

export type TestOutcome = {
  testCaseId: string;
  passed: boolean;
  actualOutput: string;
  stderr: string | null;
  runtimeMs: number;
  order: number;
};

/** Sandbox backend interfeysi — Pyodide, Piston yoki boshqasi. */
export interface CodeRunner {
  readonly name: string;
  run(language: string, code: string, stdin: string): Promise<RunResult>;
}

/**
 * Chiqishni solishtirish. O'quvchi oxiridagi bo'sh qator yoki qator
 * oxiridagi probel uchun ball yo'qotmasligi kerak.
 */
export function outputsMatch(expected: string, actual: string): boolean {
  const norm = (s: string) =>
    s
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();
  return norm(expected) === norm(actual);
}
