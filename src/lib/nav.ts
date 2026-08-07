import type { Role } from "@/generated/prisma/enums";

export type NavItem = {
  href: string;
  label: string;
  /** lucide-react ikonka nomi */
  icon: string;
  /** Telefondagi pastki panelda ko'rinadimi (maksimum 5 ta) */
  mobile?: boolean;
  /** Faol deb hisoblash uchun aniq moslik talab qilinadimi */
  exact?: boolean;
};

const STUDENT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Bosh sahifa", icon: "house", mobile: true, exact: true },
  { href: "/assignments", label: "Vazifalar", icon: "clipboard-list", mobile: true },
  { href: "/quizzes", label: "Testlar", icon: "list-checks", mobile: true },
  { href: "/progress", label: "Rivojlanish", icon: "trending-up", mobile: true },
  { href: "/profile", label: "Profil", icon: "user", mobile: true },
  { href: "/leaderboard", label: "Reyting", icon: "trophy" },
];

const TEACHER_NAV: NavItem[] = [
  { href: "/dashboard/teacher", label: "Bosh sahifa", icon: "house", mobile: true, exact: true },
  { href: "/manage/assignments", label: "Vazifalar", icon: "clipboard-list", mobile: true },
  { href: "/students", label: "O'quvchilar", icon: "users", mobile: true },
  { href: "/manage/quizzes", label: "Testlar", icon: "list-checks", mobile: true },
  { href: "/reports", label: "Hisobot", icon: "chart-column", mobile: true },
  { href: "/groups", label: "Guruhlar", icon: "layers" },
  { href: "/topics", label: "Mavzular", icon: "book-open" },
  { href: "/review-queue", label: "Tasdiqlash navbati", icon: "inbox" },
];

export function navFor(role: Role): NavItem[] {
  return role === "TEACHER" ? TEACHER_NAV : STUDENT_NAV;
}

export function mobileNavFor(role: Role): NavItem[] {
  return navFor(role).filter((i) => i.mobile).slice(0, 5);
}

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}
