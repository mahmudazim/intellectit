import {
  BookOpen,
  ChartColumn,
  ClipboardList,
  House,
  Inbox,
  Layers,
  ListChecks,
  TrendingUp,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Faqat navigatsiyada ishlatiladigan ikonkalar. Butun lucide paketini
 * dinamik import qilmaymiz — bu bundle hajmini keskin oshiradi.
 */
const ICONS: Record<string, LucideIcon> = {
  house: House,
  "clipboard-list": ClipboardList,
  "list-checks": ListChecks,
  "trending-up": TrendingUp,
  user: User,
  users: Users,
  trophy: Trophy,
  "chart-column": ChartColumn,
  layers: Layers,
  "book-open": BookOpen,
  inbox: Inbox,
};

export function NavIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Cmp = ICONS[name] ?? House;
  return <Cmp size={size} aria-hidden strokeWidth={2} />;
}
