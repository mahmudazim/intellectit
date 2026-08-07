import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pyodide WebAssembly va Prisma engine'ni bundle qilmaslik kerak —
  // ular Node runtime'da to'g'ridan-to'g'ri node_modules'dan yuklanadi.
  serverExternalPackages: ["pyodide", "@prisma/client", "@prisma/adapter-pg"],

  // Vercel'ga deploy qilganda `sandbox/` papkasi ham funksiya ichiga tushsin
  outputFileTracingIncludes: {
    "/api/submissions": ["./sandbox/**"],
  },
};

export default nextConfig;
