import type { ExtensionSettings } from "./settings.js";

/** Checks run today, keyed by the local calendar day. */
export interface DailyUsage {
  day: string;
  checks: number;
}

const MINUTE_MS = 60_000;

export function localDay(now: number): string {
  const date = new Date(now);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseUsage(raw: unknown, now: number): DailyUsage {
  const day = localDay(now);
  const record = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (record.day !== day || typeof record.checks !== "number" || !Number.isFinite(record.checks)) return { day, checks: 0 };
  return { day, checks: Math.max(0, Math.floor(record.checks)) };
}

export function countCheck(usage: DailyUsage, now: number): DailyUsage {
  const today = parseUsage(usage, now);
  return { day: today.day, checks: today.checks + 1 };
}

/** True when automatic checks must wait for tomorrow. */
export function dailyLimitReached(settings: ExtensionSettings, usage: DailyUsage, now: number): boolean {
  return settings.dailyCheckLimit > 0 && parseUsage(usage, now).checks >= settings.dailyCheckLimit;
}

function deadline(settings: ExtensionSettings, now: number): number | null {
  return settings.checksEnabled && settings.autoOffMinutes > 0 ? now + settings.autoOffMinutes * MINUTE_MS : null;
}

/**
 * Turns checks off once their deadline has passed, and gives running checks a deadline
 * when they have none (first run, or settings saved before auto-off existed).
 */
export function applyAutoOff(settings: ExtensionSettings, now: number): ExtensionSettings {
  if (!settings.checksEnabled || settings.autoOffMinutes === 0) {
    return settings.checksOffAt === null ? settings : { ...settings, checksOffAt: null };
  }
  if (settings.checksOffAt === null) return { ...settings, checksOffAt: deadline(settings, now) };
  if (now >= settings.checksOffAt) return { ...settings, checksEnabled: false, checksOffAt: null };
  return settings;
}

/**
 * The deadline restarts when checks are turned on or the auto-off time changes.
 * The page's copy of checksOffAt is ignored; only the background sets it.
 */
export function settingsAfterSave(previous: ExtensionSettings, next: ExtensionSettings, now: number): ExtensionSettings {
  const restart = (next.checksEnabled && !previous.checksEnabled) || next.autoOffMinutes !== previous.autoOffMinutes;
  const checksOffAt = restart ? deadline(next, now) : next.checksEnabled ? previous.checksOffAt : null;
  return applyAutoOff({ ...next, checksOffAt }, now);
}

/** A manual check counts as use: the deadline restarts from now. */
export function extendAutoOff(settings: ExtensionSettings, now: number): ExtensionSettings {
  return settings.checksEnabled ? { ...settings, checksOffAt: deadline(settings, now) } : settings;
}
