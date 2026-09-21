import { useLayoutEffect } from "react";
import type { ThemePreference } from "../lib/settings.js";
import { applyResolvedTheme, resolveTheme } from "../lib/theme.js";

export function useTheme(preference: ThemePreference): void {
  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyResolvedTheme(resolveTheme(preference, media.matches));
    sync();
    if (preference !== "system") return;
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [preference]);
}
