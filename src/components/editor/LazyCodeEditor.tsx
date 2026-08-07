"use client";

import dynamic from "next/dynamic";

import type { CodeEditorProps } from "./CodeEditor";

/**
 * CodeMirror faqat kerak bo'lganda yuklanadi (~250KB).
 * Trafik tejash muhim — o'quvchilarning ko'pi mobil internetda.
 */
const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[260px] items-center justify-center rounded-md border border-border bg-muted/40 text-sm text-muted-foreground">
      Muharrir yuklanmoqda...
    </div>
  ),
});

export function LazyCodeEditor(props: CodeEditorProps) {
  return <CodeEditor {...props} />;
}
