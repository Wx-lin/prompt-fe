"use client";

import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";
import { useTheme } from "@/components/theme-provider/theme-provider";

export function ThemeToggleControl() {
  const { theme, preference, setPreference } = useTheme();
  return <ThemeToggle theme={theme} preference={preference} onPreferenceChange={setPreference} />;
}
