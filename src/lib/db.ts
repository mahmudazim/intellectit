import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 driver adapter orqali ishlaydi. Neon'ning pooled connection string'i
// ishlatiladi (`-pooler` bilan) — serverless muhitda ulanishlar tugab qolmasligi uchun.
const createClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

// Dev rejimida hot-reload har safar yangi ulanish ochmasligi uchun globalga saqlaymiz.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
