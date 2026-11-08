import {
  CalendarDays,
  CalendarOff,
  LayoutDashboard,
  Music2,
  ScrollText,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { APP } from "./app.config";

export type PageKey = "dashboard" | "jadwal" | "audio" | "libur" | "log" | "settings";

export interface RouteDef {
  key: PageKey;
  path: string;
  label: string;
  title: string;
  icon: LucideIcon;
}

export const ROUTES: readonly RouteDef[] = [
  { key: "dashboard", path: "/", label: "Dashboard", title: "Dashboard", icon: LayoutDashboard },
  { key: "jadwal", path: "/jadwal", label: "Jadwal", title: "Jadwal", icon: CalendarDays },
  { key: "audio", path: "/audio", label: "Audio", title: "Audio", icon: Music2 },
  { key: "libur", path: "/libur", label: "Libur", title: "Hari Libur", icon: CalendarOff },
  { key: "log", path: "/log", label: "Log", title: "Log Aktivitas", icon: ScrollText },
  { key: "settings", path: "/settings", label: "Pengaturan", title: "Pengaturan", icon: Settings2 },
];

export const PATHS: string[] = ROUTES.map((r) => r.path);

export const PATH_TO_KEY: Record<string, PageKey> = Object.fromEntries(
  ROUTES.map((r) => [r.path, r.key]),
) as Record<string, PageKey>;

export function titleOf(path: string): string {
  return ROUTES.find((r) => r.path === path)?.title ?? APP.name;
}
