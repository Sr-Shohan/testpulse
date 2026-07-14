"use client";

import { Moon, Sun } from "lucide-react";
import { clsx } from "clsx";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = theme === "dark";
  // Until `mounted` is true the client and server may disagree on the
  // resolved theme. We render a stable label/title for that first paint
  // so React's hydration diff sees identical HTML on both sides; the
  // effect-bound state update will swap to the precise label moments later.
  const label = !mounted
    ? "Toggle theme"
    : isDark
      ? "Switch to light mode"
      : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      // NOTE: slate utilities are inverted in light mode globally
      // (see app/globals.css), so dark-mode color choices read
      // correctly in both themes without extra `dark:` variants.
      className={clsx(
        "relative z-[60] flex h-9 w-9 items-center justify-center rounded-lg border",
        "bg-slate-800/60 border-slate-700/60 text-slate-400",
        "hover:text-slate-100 hover:border-slate-600 hover:bg-slate-800",
        "transition-all duration-200"
      )}
    >
      <Sun
        className={clsx(
          "h-4 w-4 transition-all duration-200",
          !mounted || isDark
            ? "scale-0 rotate-90 opacity-0"
            : "scale-100 rotate-0 opacity-100"
        )}
      />
      <Moon
        className={clsx(
          "absolute h-4 w-4 transition-all duration-200",
          !mounted || isDark
            ? "scale-100 rotate-0 opacity-100"
            : "scale-0 -rotate-90 opacity-0"
        )}
      />
    </button>
  );
}
