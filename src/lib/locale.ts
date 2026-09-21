import type { LocalePreference } from "./settings.js";

export type ResolvedLocale = "ja" | "en";

export function resolveLocale(preference: LocalePreference, languageTag: string): ResolvedLocale {
  if (preference === "ja" || preference === "en") return preference;
  const tag = languageTag.trim().toLowerCase();
  if (tag === "ja" || tag.startsWith("ja-") || tag.startsWith("ja_")) return "ja";
  return "en";
}

export function applyResolvedLocale(resolved: ResolvedLocale): void {
  document.documentElement.lang = resolved;
}
