export type ThemePreference = "system" | "light" | "dark";
export type LocalePreference = "system" | "ja" | "en";

export interface ExtensionSettings {
  apiKey: string;
  ackedVersion: number | null;
  checksEnabled: boolean;
  checkOnlyWhenSidebarOpens: boolean;
  followTab: boolean;
  recheckOnChange: boolean;
  debounceMs: number;
  minWords: number;
  theme: ThemePreference;
  locale: LocalePreference;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  apiKey: "",
  ackedVersion: null,
  checksEnabled: true,
  checkOnlyWhenSidebarOpens: false,
  followTab: true,
  recheckOnChange: true,
  debounceMs: 1500,
  minWords: 40,
  theme: "system",
  locale: "system",
};

export function parseTheme(value: unknown): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_SETTINGS.theme;
}

export function parseLocale(value: unknown): LocalePreference {
  return value === "ja" || value === "en" || value === "system" ? value : DEFAULT_SETTINGS.locale;
}

function finiteInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function parseSettings(raw: unknown): ExtensionSettings {
  const record = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    apiKey: typeof record.apiKey === "string" ? record.apiKey : "",
    ackedVersion: typeof record.ackedVersion === "number" && Number.isInteger(record.ackedVersion) ? record.ackedVersion : null,
    checksEnabled: record.checksEnabled !== false,
    checkOnlyWhenSidebarOpens: record.checkOnlyWhenSidebarOpens === true,
    followTab: record.followTab !== false,
    recheckOnChange: record.recheckOnChange !== false,
    debounceMs: finiteInt(record.debounceMs, DEFAULT_SETTINGS.debounceMs, 250, 15000),
    minWords: finiteInt(record.minWords, DEFAULT_SETTINGS.minWords, 10, 400),
    theme: parseTheme(record.theme),
    locale: parseLocale(record.locale),
  };
}

export function setupGap(settings: ExtensionSettings, definitionVersion: number): "api-key" | "approval" | null {
  if (settings.ackedVersion !== definitionVersion) return "approval";
  if (settings.apiKey.trim() === "") return "api-key";
  return null;
}
