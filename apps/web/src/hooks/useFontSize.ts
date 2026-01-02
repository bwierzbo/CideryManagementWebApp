"use client";

import { useState, useEffect, useCallback } from "react";

export type FontSize = "small" | "medium" | "large";

const FONT_SIZE_KEY = "ciderycraft-font-size";

const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  small: "text-scale-small",
  medium: "text-scale-medium",
  large: "text-scale-large",
};

/**
 * Hook to manage font size preference
 * Stores in localStorage and applies CSS class to html element
 */
export function useFontSize() {
  const [fontSize, setFontSizeState] = useState<FontSize>("medium");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(FONT_SIZE_KEY) as FontSize | null;
    if (stored && ["small", "medium", "large"].includes(stored)) {
      setFontSizeState(stored);
    }
    setIsLoaded(true);
  }, []);

  // Apply CSS class to html element when fontSize changes
  useEffect(() => {
    if (!isLoaded) return;

    const html = document.documentElement;

    // Remove all font size classes
    Object.values(FONT_SIZE_CLASSES).forEach((cls) => {
      html.classList.remove(cls);
    });

    // Add the current font size class
    html.classList.add(FONT_SIZE_CLASSES[fontSize]);
  }, [fontSize, isLoaded]);

  const setFontSize = useCallback((size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem(FONT_SIZE_KEY, size);
  }, []);

  return {
    fontSize,
    setFontSize,
    isLoaded,
  };
}

/**
 * Get font size label for display
 */
export function getFontSizeLabel(size: FontSize): string {
  const labels: Record<FontSize, string> = {
    small: "Small",
    medium: "Medium",
    large: "Large",
  };
  return labels[size];
}
