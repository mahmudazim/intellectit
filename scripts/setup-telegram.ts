import "dotenv/config";

/**
 * Telegram botni sozlaydi: webhook manzili, buyruqlar ro'yxati, menyu tugmasi.
 *
 * Ishlatish (deploy qilingandan KEYIN):
 *   npx tsx scripts/setup-telegram.ts
 *
 * .env da bo'lishi kerak:
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

if (!token) {
  console.error("XATO: TELEGRAM_BOT_TOKEN o'rnatilmagan.");
  process.exit(1);
}
if (!appUrl || appUrl.includes("localhost")) {
  console.error(
    "XATO: NEXT_PUBLIC_APP_URL haqiqiy https manzil bo'lishi kerak.\n" +
      "Telegram localhost'ga webhook yubora olmaydi — avval deploy qiling."
  );
  process.exit(1);
}

const api = `https://api.telegram.org/bot${token}`;

async function call(method: string, body: unknown) {
  const res = await fetch(`${api}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error(`  ${method} XATO:`, data.description);
    return false;
  }
  return true;
}

(async () => {
  // Bot haqida ma'lumot
  const me = await fetch(`${api}/getMe`).then((r) => r.json());
  if (!me.ok) {
    console.error("XATO: bot topilmadi. Token to'g'rimi?");
    process.exit(1);
  }
  console.log(`Bot: @${me.result.username} (${me.result.first_name})`);
  console.log(
    `\nDIQQAT: .env da TELEGRAM_BOT_USERNAME="${me.result.username}" bo'lishi kerak.\n`
  );

  // 1. Webhook
  const webhookUrl = `${appUrl}/api/telegram/webhook`;
  console.log(`Webhook o'rnatilmoqda: ${webhookUrl}`);
  await call("setWebhook", {
    url: webhookUrl,
    secret_token: secret || undefined,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });

  // 2. Buyruqlar
  console.log("Buyruqlar ro'yxati o'rnatilmoqda...");
  await call("setMyCommands", {
    commands: [
      { command: "vazifalar", description: "Bajarilmagan vazifalar" },
      { command: "natija", description: "Oxirgi natijalar" },
      { command: "reyting", description: "Guruh reytingi" },
      { command: "streak", description: "XP, daraja va streak" },
      { command: "yordam", description: "Yordam" },
    ],
    language_code: "uz",
  });
  await call("setMyCommands", {
    commands: [
      { command: "vazifalar", description: "Bajarilmagan vazifalar" },
      { command: "natija", description: "Oxirgi natijalar" },
      { command: "reyting", description: "Guruh reytingi" },
      { command: "streak", description: "XP, daraja va streak" },
      { command: "yordam", description: "Yordam" },
    ],
  });

  // 3. Menyu tugmasi — Mini App
  console.log("Mini App menyu tugmasi o'rnatilmoqda...");
  await call("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Platforma",
      web_app: { url: `${appUrl}/miniapp` },
    },
  });

  // 4. Tavsif
  await call("setMyDescription", {
    description:
      "IntellectIT — IT darslari uchun o'quv platformasi. Vazifa, test va natijalaringizni shu yerda ko'rasiz.",
    language_code: "uz",
  });

  // Tekshiruv
  const info = await fetch(`${api}/getWebhookInfo`).then((r) => r.json());
  console.log("\n--- Natija ---");
  console.log("Webhook:", info.result.url || "(yo'q)");
  console.log("Kutilayotgan xabarlar:", info.result.pending_update_count);
  if (info.result.last_error_message) {
    console.log("Oxirgi xato:", info.result.last_error_message);
  }
  console.log("\nTayyor. Botga /start yozib ko'ring.");
})();
