import {
  Award,
  Crown,
  Flame,
  Footprints,
  Moon,
  Repeat,
  Sparkles,
  Sun,
  Sunrise,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  footprints: Footprints,
  repeat: Repeat,
  sparkles: Sparkles,
  target: Target,
  sunrise: Sunrise,
  flame: Flame,
  crown: Crown,
  "trending-up": TrendingUp,
  moon: Moon,
  sun: Sun,
  award: Award,
};

export function BadgeIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Cmp = ICONS[name] ?? Award;
  return <Cmp size={size} aria-hidden />;
}
