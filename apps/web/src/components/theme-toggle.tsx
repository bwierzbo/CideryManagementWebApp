"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * Light/dark toggle (same pattern as the orchard app's UserMenu toggle).
 * Hydration-guarded so the server-rendered icon can't mismatch.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) return <span className="p-2 w-[36px]" aria-hidden />;

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label={
        resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
    >
      {resolvedTheme === "dark" ? (
        <Sun aria-hidden className="w-[18px] h-[18px]" />
      ) : (
        <Moon aria-hidden className="w-[18px] h-[18px]" />
      )}
    </button>
  );
}
