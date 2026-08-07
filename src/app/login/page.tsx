import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";

import { auth } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Kirish" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const params = await searchParams;
  const raw = params.next;
  const nextPath = typeof raw === "string" && raw.startsWith("/") ? raw : "/";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <GraduationCap size={28} aria-hidden />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">IntellectIT</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kirish uchun o'qituvchi bergan login va parolni yozing
          </p>
        </div>

        <LoginForm next={nextPath} />

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Parolni unutdingizmi? O'qituvchingizga murojaat qiling.
        </p>
      </div>
    </main>
  );
}
