import pLimit from "p-limit";

import type { CodeRunner, RunResult } from "./types";

/**
 * Piston backend — ixtiyoriy.
 *
 * DIQQAT: `emkc.org` dagi ochiq Piston API 2026-02-15 dan boshlab faqat
 * whitelist bo'yicha ishlaydi (401 qaytaradi). Shuning uchun standart backend
 * Pyodide. Bu backend faqat o'z serveringizda Piston ko'targaningizda kerak:
 *
 *   docker run -d -p 2000:2000 --name piston ghcr.io/engineer-man/piston
 *   CODE_RUNNER=piston
 *   PISTON_URL=http://localhost:2000/api/v2
 *
 * Afzalligi: Python'dan tashqari tillar (JS, C++, Java) ham qo'llanadi.
 */

const PISTON_URL = process.env.PISTON_URL ?? "https://emkc.org/api/v2/piston";
const CONCURRENCY = Number(process.env.PISTON_CONCURRENCY ?? 3);
const RUN_TIMEOUT_MS = 5000;

const limit = pLimit(CONCURRENCY);

const LANGUAGES: Record<
  string,
  { language: string; version: string; file: string }
> = {
  python: { language: "python", version: "3.12.0", file: "main.py" },
  javascript: { language: "javascript", version: "20.11.1", file: "main.js" },
};

type PistonResponse = {
  run?: { stdout?: string; stderr?: string; code?: number | null };
  compile?: { stderr?: string };
  message?: string;
};

export const pistonRunner: CodeRunner = {
  name: "piston",
  async run(languageKey, code, stdin): Promise<RunResult> {
    const lang = LANGUAGES[languageKey];
    if (!lang) {
      return {
        stdout: "",
        stderr: "",
        timedOut: false,
        runtimeMs: 0,
        infraError: `Qo'llab-quvvatlanmaydigan til: ${languageKey}`,
      };
    }

    return limit(async () => {
      const started = Date.now();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS + 8000);

        const res = await fetch(`${PISTON_URL}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: lang.language,
            version: lang.version,
            files: [{ name: lang.file, content: code }],
            stdin,
            run_timeout: RUN_TIMEOUT_MS,
            compile_timeout: 10000,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          return {
            stdout: "",
            stderr: "",
            timedOut: false,
            runtimeMs: Date.now() - started,
            infraError:
              res.status === 429
                ? "Sandbox band. Bir necha soniyadan keyin urinib ko'ring."
                : res.status === 401
                  ? "Piston API ruxsat bermadi. O'z serveringizda Piston ko'taring yoki CODE_RUNNER=pyodide qiling."
                  : `Sandbox xatosi (${res.status}). ${body.slice(0, 120)}`,
          };
        }

        const data = (await res.json()) as PistonResponse;
        const compileErr = data.compile?.stderr?.trim();
        const run = data.run ?? {};
        const stderr = compileErr
          ? `${compileErr}\n${run.stderr ?? ""}`
          : (run.stderr ?? "");

        return {
          stdout: run.stdout ?? "",
          stderr,
          // Piston timeout'da signal beradi, stderr'da "killed" bo'ladi
          timedOut: /timed? ?out|killed/i.test(stderr),
          runtimeMs: Date.now() - started,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          stdout: "",
          stderr: "",
          timedOut: false,
          runtimeMs: Date.now() - started,
          infraError: /abort|timeout/i.test(msg)
            ? "Sandbox javob bermadi (vaqt tugadi)."
            : `Sandbox'ga ulanib bo'lmadi: ${msg}`,
        };
      }
    });
  },
};
