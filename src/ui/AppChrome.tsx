import type { ReactNode } from "react";
import type { LocalePreference, ThemePreference } from "../lib/settings.js";
import { AppHeader } from "./bits.js";
import { LocaleProvider, useResolvedLocale } from "./useLocale.js";
import { useTheme } from "./useTheme.js";

export function AppChrome({
  meta,
  wide = false,
  theme = "system",
  locale = "system",
  children,
}: {
  meta?: string;
  wide?: boolean;
  theme?: ThemePreference;
  locale?: LocalePreference;
  children: ReactNode;
}) {
  useTheme(theme);
  const resolved = useResolvedLocale(locale);
  return (
    <LocaleProvider locale={resolved}>
      <AppHeader meta={meta} />
      <main className={wide ? "shell wide" : "shell"}>{children}</main>
    </LocaleProvider>
  );
}
