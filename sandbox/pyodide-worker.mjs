/**
 * Pyodide worker — o'quvchi kodini alohida oqimda (thread) bajaradi.
 *
 * Nega worker:
 *  1. Cheksiz siklni to'xtatish uchun interrupt buffer kerak (SharedArrayBuffer),
 *     u faqat asosiy oqimdan boshqa oqimga signal bera oladi.
 *  2. Kod bajarilishi Next.js server oqimini bloklamaydi.
 *
 * Bu fayl ATAYLAB `src/` dan tashqarida — Next.js uni bundle qilmasligi kerak.
 */
import fs from "node:fs";
import path from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import { loadPyodide } from "pyodide";

/**
 * Pyodide o'zining .wasm va .asm.mjs fayllarini topishi uchun indexURL kerak.
 * Avtomatik aniqlash Next.js/Turbopack ichida buziladi, `require.resolve` esa
 * bundler tomonidan qayta yozilishi mumkin — shuning uchun papkani
 * to'g'ridan-to'g'ri fayl tizimidan qidiramiz.
 */
function findPyodideDir() {
  const candidates = [
    process.env.PYODIDE_DIR,
    path.join(process.cwd(), "node_modules", "pyodide"),
    // monorepo yoki hoisting holati uchun yuqoriga chiqamiz
    path.join(process.cwd(), "..", "node_modules", "pyodide"),
    path.join(process.cwd(), "..", "..", "node_modules", "pyodide"),
  ].filter(Boolean);

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "pyodide.asm.mjs"))) return dir;
  }
  throw new Error(
    `pyodide papkasi topilmadi. Qaralgan joylar: ${candidates.join(", ")}`
  );
}

const py = await loadPyodide({ indexURL: findPyodideDir() });
py.setInterruptBuffer(workerData.interruptBuffer);

// Har bir bajarish uchun toza global fazo yaratish uchun kerak
const dictCtor = py.globals.get("dict");

parentPort.postMessage({ type: "ready" });

parentPort.on("message", ({ id, code, stdin }) => {
  let stdout = "";
  let stderr = "";

  const inputLines = String(stdin ?? "").split("\n");
  let lineIndex = 0;

  py.setStdin({
    // null qaytarilsa Python EOFError beradi — bu to'g'ri xatti-harakat
    stdin: () => (lineIndex < inputLines.length ? inputLines[lineIndex++] : null),
  });
  py.setStdout({ batched: (s) => { stdout += s + "\n"; } });
  py.setStderr({ batched: (s) => { stderr += s + "\n"; } });

  // Toza global fazo: avvalgi bajarishdan qolgan o'zgaruvchilar ko'rinmasin
  const ns = dictCtor();

  try {
    py.runPython(code, { globals: ns });
    parentPort.postMessage({ id, ok: true, stdout, stderr, timedOut: false });
  } catch (e) {
    const raw = String(e);
    const timedOut = raw.includes("KeyboardInterrupt");
    parentPort.postMessage({
      id,
      ok: false,
      stdout,
      stderr: timedOut ? "" : cleanTraceback(raw),
      timedOut,
    });
  } finally {
    ns.destroy();
  }
});

/**
 * Pyodide traceback'idan ichki qatorlarni olib tashlaydi — o'quvchi faqat
 * o'z kodiga tegishli xatoni ko'rsin.
 */
function cleanTraceback(raw) {
  const lines = raw.split("\n");
  const start = lines.findIndex((l) => l.includes('File "<exec>"'));
  const useful = start >= 0 ? lines.slice(start) : lines.slice(-6);
  return useful
    .filter((l) => !l.includes("/lib/python") && !l.includes("_pyodide"))
    .join("\n")
    .trim();
}
