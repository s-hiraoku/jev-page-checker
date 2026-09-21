import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import { copyFor, type Copy } from "../lib/copy.js";
import { applyResolvedLocale, resolveLocale, type ResolvedLocale } from "../lib/locale.js";
import type { LocalePreference } from "../lib/settings.js";

const LocaleContext = createContext<ResolvedLocale>("ja");

export function LocaleProvider({ locale, children }: { locale: ResolvedLocale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): ResolvedLocale {
  return useContext(LocaleContext);
}

export function useCopy(): Copy {
  return copyFor(useLocale());
}

export function useResolvedLocale(preference: LocalePreference): ResolvedLocale {
  const [resolved, setResolved] = useState<ResolvedLocale>(() =>
    resolveLocale(preference, typeof navigator === "undefined" ? "ja" : navigator.language),
  );
  useLayoutEffect(() => {
    const sync = () => {
      const next = resolveLocale(preference, navigator.language);
      applyResolvedLocale(next);
      setResolved(next);
    };
    sync();
    if (preference !== "system") return;
    window.addEventListener("languagechange", sync);
    return () => window.removeEventListener("languagechange", sync);
  }, [preference]);
  return resolved;
}
