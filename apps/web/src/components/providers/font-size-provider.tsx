"use client";

import { useEffect } from "react";

type FontSize = "small" | "medium" | "large";

const FONT_SIZE_KEY = "ciderycraft-font-size";

const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  small: "text-scale-small",
  medium: "text-scale-medium",
  large: "text-scale-large",
};

/**
 * Provider component that initializes font size preference on app load
 * Reads from localStorage and applies CSS class to html element
 */
export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Read preference from localStorage
    const stored = localStorage.getItem(FONT_SIZE_KEY) as FontSize | null;
    const fontSize: FontSize =
      stored && ["small", "medium", "large"].includes(stored)
        ? stored
        : "medium";

    // Apply CSS class to html element
    const html = document.documentElement;
    Object.values(FONT_SIZE_CLASSES).forEach((cls) => {
      html.classList.remove(cls);
    });
    html.classList.add(FONT_SIZE_CLASSES[fontSize]);
  }, []);

  return <>{children}</>;
}
