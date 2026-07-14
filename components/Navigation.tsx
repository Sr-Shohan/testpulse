"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  History,
  Bug,
  Activity,
  ArrowRightLeft,
  Map as MapIcon,
} from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/flaky", label: "Flaky Tests", icon: Bug },
  { href: "/compare", label: "Compare", icon: ArrowRightLeft },
  { href: "/matrix", label: "Stability Matrix", icon: MapIcon },
  { href: "/builds", label: "Build History", icon: History },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 p-1 bg-slate-900/80 backdrop-blur-lg border border-slate-800/60 rounded-xl">
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20"
                : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
            )}
          >
            <item.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
      <div className="ml-auto flex items-center gap-2 px-3">
        <Activity className="w-3.5 h-3.5 text-emerald-400" aria-hidden />
        <span className="text-xs text-slate-500 hidden md:inline">Live</span>
      </div>
    </nav>
  );
}
