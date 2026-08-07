"use client";

import type { EditorView } from "@codemirror/view";
import { indentMore, undo } from "@codemirror/commands";
import { Undo2 } from "lucide-react";

/**
 * Telefonda kod yozishning eng katta og'rig'i — `:`, `_`, `()`, `[]` kabi
 * belgilar virtual klaviaturaning ikkinchi/uchinchi qatlamida bo'lishi.
 * Bu panel ularni klaviatura ustiga chiqaradi.
 *
 * MUHIM: tugmada `onMouseDown` da `preventDefault()` chaqiriladi — aks holda
 * muharrir fokusni yo'qotadi va telefonda klaviatura yopiladi.
 */

type Key = {
  label: string;
  /** Kiritiladigan matn (label'dan farq qilsa) */
  insert?: string;
  /** Kiritilgandan keyin kursorni necha belgi chapga surish */
  back?: number;
  wide?: boolean;
};

const PYTHON_KEYS: Key[] = [
  { label: "⇥", insert: "    ", wide: true },
  { label: ":" },
  { label: "_" },
  { label: "()", insert: "()", back: 1 },
  { label: "[]", insert: "[]", back: 1 },
  { label: '""', insert: '""', back: 1 },
  { label: "=" },
  { label: "<" },
  { label: ">" },
  { label: "#" },
  { label: "," },
  { label: "." },
];

const HTML_KEYS: Key[] = [
  { label: "⇥", insert: "  ", wide: true },
  { label: "<" },
  { label: ">" },
  { label: "</", insert: "</" },
  { label: "/" },
  { label: "=" },
  { label: '""', insert: '""', back: 1 },
  { label: "-" },
  { label: ":" },
  { label: ";" },
];

const CSS_KEYS: Key[] = [
  { label: "⇥", insert: "  ", wide: true },
  { label: "{}", insert: "{}", back: 1 },
  { label: ":" },
  { label: ";" },
  { label: "-" },
  { label: "#" },
  { label: "." },
  { label: "%" },
  { label: "px", insert: "px" },
  { label: "()", insert: "()", back: 1 },
];

export function keysFor(language: string): Key[] {
  if (language === "html") return HTML_KEYS;
  if (language === "css") return CSS_KEYS;
  return PYTHON_KEYS;
}

export function SymbolToolbar({
  view,
  language,
}: {
  view: EditorView | null;
  language: string;
}) {
  const keys = keysFor(language);

  const insert = (key: Key) => {
    if (!view) return;

    // Tab tugmasi: CodeMirror'ning o'z indent buyrug'i (blok tanlangan bo'lsa ham ishlaydi)
    if (key.label === "⇥") {
      indentMore(view);
      view.focus();
      return;
    }

    const text = key.insert ?? key.label;
    const { from, to } = view.state.selection.main;
    const cursor = from + text.length - (key.back ?? 0);

    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: cursor },
      scrollIntoView: true,
    });
    view.focus();
  };

  return (
    <div
      className="scroll-x flex gap-1 border-t border-border bg-muted/60 p-1.5 lg:hidden"
      role="toolbar"
      aria-label="Kod belgilari"
    >
      {keys.map((key) => (
        <button
          key={key.label}
          type="button"
          // Fokusni saqlash uchun — klaviatura yopilmasin
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}
          onClick={() => insert(key)}
          className={`h-10 shrink-0 rounded-md border border-border bg-background font-mono text-base active:bg-muted ${
            key.wide ? "px-4" : "min-w-10 px-2.5"
          }`}
        >
          {key.label}
        </button>
      ))}

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onTouchStart={(e) => e.preventDefault()}
        onClick={() => {
          if (!view) return;
          undo(view);
          view.focus();
        }}
        aria-label="Orqaga qaytarish"
        className="ml-auto flex h-10 min-w-10 shrink-0 items-center justify-center rounded-md border border-border bg-background active:bg-muted"
      >
        <Undo2 size={17} aria-hidden />
      </button>
    </div>
  );
}
