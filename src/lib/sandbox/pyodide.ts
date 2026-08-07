import path from "node:path";
import { Worker } from "node:worker_threads";

import type { CodeRunner, RunResult } from "./types";

/**
 * Pyodide (WebAssembly Python) backend — standart tanlov.
 *
 * Nega shu:
 *  - Bepul va limitsiz (tashqi xizmat yo'q, Piston'ning ochiq API'si
 *    2026-02-15 dan whitelist bo'lib qoldi).
 *  - Vercel'ning Node runtime'ida ishlaydi.
 *  - Kod bizning fayl tizimimizga yoki tarmoqqa kira olmaydi (WASM sandbox).
 *
 * Cheklov: faqat Python. HTML/CSS uchun bajarish kerak emas, JS uchun
 * kelajakda alohida backend qo'shiladi.
 */

const TIMEOUT_MS = 5000;
const WORKER_PATH = path.join(process.cwd(), "sandbox", "pyodide-worker.mjs");

type WorkerReply = {
  id: number;
  ok: boolean;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

type Pool = {
  worker: Worker;
  interrupt: Uint8Array;
  ready: Promise<void>;
  /** Bir vaqtda bitta bajarish — interrupt buffer umumiy */
  queue: Promise<unknown>;
};

let pool: Pool | null = null;
let nextId = 1;

function spawn(): Pool {
  const interrupt = new Uint8Array(new SharedArrayBuffer(1));
  const worker = new Worker(WORKER_PATH, {
    workerData: { interruptBuffer: interrupt },
  });
  worker.unref(); // jarayon shu worker tufayli ochiq qolmasin

  const ready = new Promise<void>((resolve, reject) => {
    const onMessage = (m: { type?: string }) => {
      if (m?.type === "ready") {
        worker.off("message", onMessage);
        resolve();
      }
    };
    worker.on("message", onMessage);
    worker.once("error", reject);
  });

  return { worker, interrupt, ready, queue: Promise.resolve() };
}

function getPool(): Pool {
  if (!pool) pool = spawn();
  return pool;
}

/** Worker buzilgan bo'lsa qayta yaratish. */
async function resetPool() {
  const old = pool;
  pool = null;
  if (old) await old.worker.terminate().catch(() => {});
}

async function execute(code: string, stdin: string): Promise<RunResult> {
  const p = getPool();
  const started = Date.now();

  try {
    await p.ready;
  } catch (e) {
    await resetPool();
    return {
      stdout: "",
      stderr: "",
      timedOut: false,
      runtimeMs: Date.now() - started,
      infraError: `Python muhitini yuklab bo'lmadi: ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }

  const id = nextId++;

  return new Promise<RunResult>((resolve) => {
    let settled = false;

    // Interrupt ishlamasa (masalan C darajasidagi sikl) — worker'ni o'ldiramiz
    const hardKill = setTimeout(() => {
      if (settled) return;
      settled = true;
      p.worker.off("message", onMessage);
      void resetPool();
      resolve({
        stdout: "",
        stderr: "",
        timedOut: true,
        runtimeMs: Date.now() - started,
      });
    }, TIMEOUT_MS + 3000);

    // Yumshoq to'xtatish: Python'da KeyboardInterrupt ko'tariladi
    const softStop = setTimeout(() => {
      p.interrupt[0] = 2;
    }, TIMEOUT_MS);

    const onMessage = (msg: WorkerReply) => {
      if (msg?.id !== id) return;
      if (settled) return;
      settled = true;
      clearTimeout(softStop);
      clearTimeout(hardKill);
      p.interrupt[0] = 0;
      p.worker.off("message", onMessage);
      resolve({
        stdout: msg.stdout ?? "",
        stderr: msg.stderr ?? "",
        timedOut: msg.timedOut,
        runtimeMs: Date.now() - started,
      });
    };

    p.worker.on("message", onMessage);
    p.worker.postMessage({ id, code, stdin });
  });
}

export const pyodideRunner: CodeRunner = {
  name: "pyodide",
  async run(language, code, stdin): Promise<RunResult> {
    if (language !== "python") {
      return {
        stdout: "",
        stderr: "",
        timedOut: false,
        runtimeMs: 0,
        infraError: `Pyodide faqat Python'ni qo'llaydi (so'ralgan: ${language}).`,
      };
    }

    // Interrupt buffer bitta — bajarishlarni navbatga qo'yamiz
    const p = getPool();
    const task = p.queue.then(() => execute(code, stdin));
    p.queue = task.catch(() => {});
    return task;
  },
};
