import type { ResolvedLocale } from "./locale.js";

export function formatCheckedAt(iso: string, locale: ResolvedLocale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** The model that answered a stored report. Reports made before Claude was offered were all Jev. */
export function engineLabel(engine: { id: "jev" | "claude"; model?: string } | undefined): string {
  if (engine?.id !== "claude") return "Jev";
  return engine.model ? `Claude (${engine.model})` : "Claude";
}
