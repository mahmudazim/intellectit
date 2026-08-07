import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Sahifa topilmadi" };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <FileQuestion size={26} aria-hidden />
      </div>
      <h1 className="text-xl font-bold tracking-tight">Sahifa topilmadi</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Bunday sahifa mavjud emas yoki ko'chirilgan.
      </p>
      {/* Link'ni Button ichiga o'ramaymiz — <button><a> yaroqsiz HTML */}
      <Link href="/" className={buttonVariants({ size: "lg", className: "mt-6" })}>
        Bosh sahifaga qaytish
      </Link>
    </main>
  );
}
