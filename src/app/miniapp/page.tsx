import Script from "next/script";

import { MiniAppAuth } from "./MiniAppAuth";

export const metadata = { title: "IntellectIT" };

export default function MiniAppPage() {
  return (
    <>
      {/* Telegram SDK — faqat shu sahifada yuklanadi */}
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <MiniAppAuth />
    </>
  );
}
