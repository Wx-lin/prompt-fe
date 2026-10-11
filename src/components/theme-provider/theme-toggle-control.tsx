"use client";

import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";
import { useTheme } from "@/components/theme-provider/theme-provider";

export function ThemeToggleControl() {
  const { theme, toggleTheme } = useTheme();
  return <ThemeToggle theme={theme} onToggle={toggleTheme} />;
}
