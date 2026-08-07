import { NextResponse } from "next/server";

import { applyDecay } from "@/lib/mastery/update";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Har kecha ishlaydi: uzoq mashq qilinmagan mavzular bahosini pasaytiradi.
 * "O'rgangan, keyin unutgan" holatini aks ettiradi va takrorlashni
 * rag'batlantiradi.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 401 });
  }

  const { updated } = await applyDecay();
  return NextResponse.json({ yangilandi: updated });
}
