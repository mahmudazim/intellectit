# IntellectIT

Xususiy maktab IT o'qituvchisi uchun AI integratsiyalangan o'quv platformasi.
Python, HTML va CSS o'qitiladi.

**Asosiy cheklov:** o'quvchilarning ~50% ida kompyuter yo'q — platforma
telefon uchun qurilgan.

## Nima qiladi

| Vazifa | Qanday hal qilingan |
|---|---|
| Vazifa berish va tekshirish | Test-case sandbox (aniq natija) + AI izohi |
| Qo'shimcha vazifa berish | Zaif mavzuga qarab avtomatik, kuniga 2 tagacha |
| Rag'batlantirish | XP, daraja, streak, 12 ta nishon, haftalik reyting |
| Test va masalalar | 6 xil savol turi, AI savol generatsiyasi |
| Kamchilikni aniqlash | Har mavzu uchun o'zlashtirish balli (EWMA) |
| Keyingi yo'nalish | Prerekvizit ildizini topib, avval nimani tuzatishni aytadi |

---

## Ishga tushirish (lokal)

```bash
npm install
npx prisma dev start intellectit   # lokal Postgres
npm run db:push
npm run db:seed                    # o'qituvchi + 29 mavzu + 12 nishon
npm run dev                        # http://localhost:3100
```

Dev akkaunt: `ustoz` / `ozgartiring123`

Telefondan sinash (bir tarmoqda):

```bash
npm run dev:lan                    # keyin telefondan http://<kompyuter-IP>:3100
```

---

## Muhit o'zgaruvchilari

`.env.example` dan nusxa oling. Majburiylar:

| O'zgaruvchi | Nima uchun |
|---|---|
| `DATABASE_URL` | Postgres (Neon'ning **pooled** manzili) |
| `DIRECT_URL` | Migratsiya uchun (pooler**siz**) |
| `AUTH_SECRET` | `npx auth secret` bilan yarating |
| `ANTHROPIC_API_KEY` | AI baholash (asosiy) |
| `OPENAI_API_KEY` | Zaxira provayder |
| `CRON_SECRET` | Cron route'larni himoyalash |

Ixtiyoriy: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`,
`TELEGRAM_WEBHOOK_SECRET`, `AI_EFFORT` (standart `medium`),
`AI_MONTHLY_BUDGET_USD` (standart 30).

**AI kalitisiz ham ishlaydi:** test-case tekshiruvi to'liq ishlaydi, faqat
AI izohi bo'lmaydi.

---

## Deploy (Vercel + Neon)

### 1. Baza

1. [neon.tech](https://neon.tech) da bepul loyiha yarating
2. Ikkita manzilni oling:
   - **Pooled** (`-pooler` bor) → `DATABASE_URL`
   - **Direct** (`-pooler` yo'q) → `DIRECT_URL`

```bash
npm run db:push      # sxemani qo'llash
npm run db:seed      # o'quv dasturi va o'qituvchi akkaunti
```

### 2. Vercel

```bash
npx vercel
```

Vercel panelida barcha env o'zgaruvchilarni qo'shing.
`NEXT_PUBLIC_APP_URL` — haqiqiy domen (`https://...`).

**Cron'lar `vercel.json` da** — deploy qilinganda avtomatik yoqiladi:

| Vaqt (Toshkent) | Nima |
|---|---|
| har 30 daq | Muvaffaqiyatsiz AI baholashlarni qayta urinish |
| 16:00 | Muddat eslatmasi |
| 20:00 | Streak xavf ostida ogohlantirishi |
| 00:00 | Mavzu ballarini qayta hisoblash (unutish) |
| 00:30 | Zaif mavzular bo'yicha mashq taqsimlash |
| Yak 19:00 | Haftalik hisobot |

> Vercel bepul rejada kuniga 2 ta cron. Ko'proq kerak bo'lsa Pro reja yoki
> tashqi cron xizmati (cron-job.org) `CRON_SECRET` bilan.

### 3. Telegram (ixtiyoriy)

1. [@BotFather](https://t.me/BotFather) da bot yarating → token
2. `.env` ga `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`,
   `TELEGRAM_WEBHOOK_SECRET` (ixtiyoriy parol) yozing
3. Deploy qilingandan **keyin**:

```bash
npx tsx scripts/setup-telegram.ts
```

Bu webhook, buyruqlar va Mini App menyusini sozlaydi.

---

## Arxitektura

```
src/
├── app/
│   ├── (app)/          # kirgan foydalanuvchi sahifalari
│   ├── api/            # submissions, quiz-attempts, telegram, cron
│   └── miniapp/        # Telegram Mini App
├── lib/
│   ├── ai/             # anthropic.ts + openai.ts + router.ts (failover)
│   ├── sandbox/        # pyodide.ts (standart) + piston.ts (ixtiyoriy)
│   ├── mastery/        # o'zlashtirish hisobi va tavsiyalar
│   ├── gamification/   # XP, streak, nishonlar
│   └── telegram/       # bot, bildirishnomalar, initData tekshiruvi
└── proxy.ts            # rol tekshiruvi (Next 16 da middleware o'rniga)

sandbox/pyodide-worker.mjs   # src dan tashqarida — bundle qilinmasin
```

### Kod bajarish

**Pyodide** (WebAssembly Python) worker thread'da. Bepul, limitsiz,
Vercel'da ishlaydi.

> Reja Piston'ni ko'zda tutgan edi, lekin `emkc.org` dagi ochiq API
> 2026-02-15 dan whitelist bo'lib qoldi. O'z Piston serveringiz bo'lsa:
> `CODE_RUNNER=piston` + `PISTON_URL`.

Cheksiz sikl: `SharedArrayBuffer` interrupt → 5s da `KeyboardInterrupt`,
ishlamasa worker `terminate()`.

### AI

Claude (asosiy) ↔ OpenAI (zaxira), avtomatik almashinuv.
400 xatosida almashtirilmaydi (bu bizning so'rovimizdagi xato).

O'lchangan xarajat (`AI_EFFORT=medium`):

| Amal | Narx |
|---|---|
| Kod baholash | $0.020 |
| Qisqa javob (Haiku) | $0.001 |
| 5 ta savol yaratish | $0.035 |
| Vazifa yaratish | $0.046 |

25 o'quvchi × 15 vazifa ≈ **$7–8/oy**.

**AI natijalari tekshiriladi:** kod natijasi savollari va yaratilgan
vazifalar sandbox'da ishga tushiriladi. O'tmasa — tashlab yuboriladi.

---

## Buyruqlar

```bash
npm run dev          # dev server (3100)
npm run dev:lan      # telefondan sinash uchun
npm run build        # ishlab chiqarish build
npm run typecheck    # tsc --noEmit
npm run db:push      # sxemani bazaga qo'llash
npm run db:seed      # boshlang'ich ma'lumot
npm run db:studio    # bazani ko'rish
```

---

## Xavfsizlik

- `Assignment.solutionCode` va yashirin test qiymatlari o'quvchiga
  **hech qachon** yuborilmaydi (Prisma `select` bilan ajratilgan)
- Har route'da rol tekshiruvi (`requireTeacher` / `requireStudent`)
- O'quvchi boshqa o'quvchining javobini ID bo'yicha ham ololmaydi
- Prompt injection: kod `<student_code>` blokida, rubrikada himoya qoidasi
- HTML preview: `sandbox` iframe, `allow-same-origin` **berilmaydi**
- Telegram `initData` HMAC-SHA256 bilan tekshiriladi
- Cron route'lar `CRON_SECRET` bilan himoyalangan
