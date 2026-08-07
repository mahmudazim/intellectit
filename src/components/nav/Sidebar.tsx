"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, LogOut } from "lucide-react";

import { NavIcon } from "./Icon";
import { isActive, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Kompyuter uchun chap yon panel (telefonda ko'rinmaydi). */
export function Sidebar({
  items,
  fullName,
  roleLabel,
}: {
  items: NavItem[];
  fullName: string;
  roleLabel: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap size={18} aria-hidden />
        </div>
        <span className="font-semibold tracking-tight">IntellectIT</span>
      </div>

      <nav aria-label="Asosiy navigatsiya" className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <NavIcon name={item.icon} size={18} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <div className="px-2 pb-2">
          <p className="truncate text-sm font-medium">{fullName}</p>
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
        </div>
        <form action="/api/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut size={18} aria-hidden />
            Chiqish
          </button>
        </form>
      </div>
    </aside>
  );
}
