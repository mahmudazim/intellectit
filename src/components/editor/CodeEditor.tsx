"use client";

import { useCallback, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { indentUnit } from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";

import { SymbolToolbar } from "./SymbolToolbar";

/**
 * Kod muharriri — CodeMirror 6.
 *
 * Nega Monaco emas: Monaco telefonda virtual klaviatura bilan ishlamaydi
 * (kursor sakraydi, matn tanlash buziladi) va ~2MB og'ir.
 */

function langExtension(language: string) {
  if (language === "html") return html();
  if (language === "css") return css();
  return python();
}

export type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  minHeight?: string;
  ariaLabel?: string;
};

export default function CodeEditor({
  value,
  onChange,
  language = "python",
  readOnly = false,
  minHeight = "260px",
  ariaLabel = "Kod muharriri",
}: CodeEditorProps) {
  const [view, setView] = useState<EditorView | null>(null);

  const extensions = useMemo(
    () => [
      langExtension(language),
      // Python 4 probel, HTML/CSS 2 probel
      indentUnit.of(language === "python" ? "    " : "  "),
      // Telefonda gorizontal scroll bo'lmasligi uchun uzun qatorlar o'raladi
      EditorView.lineWrapping,
      EditorState.tabSize.of(language === "python" ? 4 : 2),
      EditorView.theme({
        "&": { fontSize: "15px" },
        ".cm-content": {
          fontFamily: "var(--font-mono)",
          padding: "10px 0",
          // Telefonda avtomatik tuzatish kodni buzadi
          caretColor: "hsl(var(--primary))",
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          border: "none",
          color: "hsl(var(--muted-foreground))",
        },
        "&.cm-focused": { outline: "none" },
        ".cm-scroller": { fontFamily: "var(--font-mono)" },
      }),
      EditorView.contentAttributes.of({
        "aria-label": ariaLabel,
        autocapitalize: "off",
        autocorrect: "off",
        spellcheck: "false",
      }),
    ],
    [language, ariaLabel]
  );

  const handleChange = useCallback(
    (val: string, _update: ViewUpdate) => onChange(val),
    [onChange]
  );

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <CodeMirror
        value={value}
        height="auto"
        minHeight={minHeight}
        editable={!readOnly}
        readOnly={readOnly}
        extensions={extensions}
        onChange={handleChange}
        onCreateEditor={(v) => setView(v)}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: !readOnly,
          // Telefonda o'z-o'zidan chiqadigan taklif ro'yxati xalaqit beradi
          autocompletion: false,
          closeBrackets: true,
          searchKeymap: false,
        }}
      />
      {!readOnly && <SymbolToolbar view={view} language={language} />}
    </div>
  );
}
