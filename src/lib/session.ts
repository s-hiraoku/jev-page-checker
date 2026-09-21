import type { Check, CheckReport } from "./checkkit.js";
import type { PageSnapshot } from "./page-state.js";
import { setupGap, type ExtensionSettings } from "./settings.js";

export interface StoredRecord {
  id: string;
  tabId: number;
  snapshot: PageSnapshot;
  report: CheckReport;
  createdAt: string;
}

export type TabSession =
  | { status: "unsupported"; url: string }
  | { status: "checking"; snapshot: PageSnapshot; fingerprint: string }
  | { status: "ready"; record: StoredRecord; fingerprint: string }
  | { status: "error"; message: string; snapshot?: PageSnapshot; fingerprint?: string };

export type SessionView =
  | { status: "needs-setup"; reason: "api-key" | "approval"; definitionVersion: number }
  | { status: "unsupported"; url: string }
  | { status: "idle"; followTab: boolean }
  | { status: "checking"; snapshot: PageSnapshot }
  | { status: "ready"; record: StoredRecord }
  | { status: "error"; message: string; snapshot?: PageSnapshot };

export interface SessionPayload {
  view: SessionView;
  questions: Check[];
  history: StoredRecord[];
  settings: ExtensionSettings;
  definitionVersion: number;
}

export function sessionView(
  settings: ExtensionSettings,
  version: number,
  session: TabSession | undefined,
): SessionView {
  const gap = setupGap(settings, version);
  if (gap !== null) return { status: "needs-setup", reason: gap, definitionVersion: version };
  if (session === undefined) return { status: "idle", followTab: settings.followTab };
  if (session.status === "unsupported") return { status: "unsupported", url: session.url };
  if (session.status === "checking") return { status: "checking", snapshot: session.snapshot };
  if (session.status === "ready") return { status: "ready", record: session.record };
  return { status: "error", message: session.message, snapshot: session.snapshot };
}

export function buildSessionPayload(
  definition: { version: number; questions: readonly Check[] },
  settings: ExtensionSettings,
  history: StoredRecord[],
  session: TabSession | undefined,
): SessionPayload {
  return {
    view: sessionView(settings, definition.version, session),
    questions: [...definition.questions],
    history,
    settings,
    definitionVersion: definition.version,
  };
}
