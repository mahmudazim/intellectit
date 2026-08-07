"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavIcon } from "./Icon";
import { isActive, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Telefon uchun pastki navigatsiya paneli.
 * `pb-safe` — iPhone'ning pastki "home indicator" chizig'i ustiga tushmasligi uchun.
 */
export function BottomTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Asosiy navigatsiya"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur pb-safe lg:hidden"
    >
      <ul className="flex">
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <NavIcon name={item.icon} size={22} />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
