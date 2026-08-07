import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";

import { auth } from "@/lib/auth";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata = { title: "Parolni o'zgartirish" };

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <KeyRound size={26} aria-hidden />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            Yangi parol o'rnating
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Birinchi kirishda parolni o'zingiznikiga almashtirish kerak.
          </p>
        </div>

        <ChangePasswordForm />
      </div>
    </main>
  );
}
