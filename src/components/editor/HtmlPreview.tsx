"use client";

import { useEffect, useState } from "react";

/**
 * O'quvchi yozgan HTML/CSS natijasini ko'rsatadi.
 *
 * XAVFSIZLIK: `sandbox` atributida `allow-same-origin` BERILMAYDI —
 * shu sabab iframe ichidagi kod bizning sahifamizga, cookie'larga yoki
 * localStorage'ga kira olmaydi.
 */
export function HtmlPreview({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const [debounced, setDebounced] = useState(code);

  // Har bosishda iframe qayta yuklanmasin
  useEffect(() => {
    const t = setTimeout(() => setDebounced(code), 400);
    return () => clearTimeout(t);
  }, [code]);

  const doc = `<!doctype html><html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;margin:12px}</style>
</head><body>${debounced}</body></html>`;

  return (
    <iframe
      title="Natija"
      sandbox="allow-scripts"
      srcDoc={doc}
      className={
        className ??
        "h-[380px] w-full rounded-md border border-border bg-white"
      }
    />
  );
}
