import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: {
    default: "IntellectIT",
    template: "%s · IntellectIT",
  },
  description: "IT darslari uchun AI yordamchisi bo'lgan o'quv platformasi",
  applicationName: "IntellectIT",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "IntellectIT",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // 1 qilmaymiz — ko'zi ojiz o'quvchi kattalashtira olishi kerak
  viewportFit: "cover", // iPhone'ning "notch" va pastki chizig'i uchun
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1218" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="uz"
      className="h-full antialiased"
      // globals.css da scroll-behavior: smooth — Next route almashuvida
      // uni to'g'ri boshqarishi uchun shu atribut kerak
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      {/*
        suppressHydrationWarning: brauzer kengaytmalari (ColorZilla, Grammarly va h.k.)
        <body> ga o'z atributlarini qo'shadi (masalan cz-shortcut-listen), bu esa
        React'da hydration mismatch ogohlantirishini keltirib chiqaradi.
        Bu bizning kodimizdagi xato emas.
      */}
      <body
        className="min-h-dvh bg-background text-foreground"
        suppressHydrationWarning
      >
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
