import Link from "next/link";
import { GraduationCap, LogOut } from "lucide-react";

/** Telefondagi yuqori qator: logotip + chiqish. Kompyuterda ko'rinmaydi. */
export function MobileTopBar({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur pt-safe lg:hidden">
      <Link href="/" className="-ml-1 flex h-11 items-center gap-2 px-1">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap size={16} aria-hidden />
        </div>
        <span className="font-semibold tracking-tight">
          {title ?? "IntellectIT"}
        </span>
      </Link>

      <form action="/api/logout" method="post">
        <button
          type="submit"
          aria-label="Chiqish"
          className="flex size-11 items-center justify-center rounded-md text-muted-foreground"
        >
          <LogOut size={18} aria-hidden />
        </button>
      </form>
    </header>
  );
}
