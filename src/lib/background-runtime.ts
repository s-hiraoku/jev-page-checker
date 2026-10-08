import Anthropic from "@anthropic-ai/sdk";
import { TypeSafeError } from "@typesafe-ai/sdk";
import { applyActionIcon, applyDefaultActionIcon } from "./action-icon.js";
import { parseDefinition, type ApprovedDefinition } from "./checkkit.js";
import { copyFor } from "./copy.js";
import { unknownErrorMessage } from "./errors.js";
import { resolveLocale, type ResolvedLocale } from "./locale.js";
import { isInspectableUrl, snapshotFingerprint, type PageSnapshot } from "./page-state.js";
import { applyAutoOff, countCheck, dailyLimitReached, extendAutoOff, parseUsage, settingsAfterSave, type DailyUsage } from "./check-guard.js";
import { ClaudeAnswerError, createLiveClaude } from "./claude-gateway.js";
import { checkSnapshot, createLiveJev } from "./run-check.js";
import { activeApiKey, DEFAULT_SETTINGS, parseSettings, setupGap, type ExtensionSettings } from "./settings.js";
import type { ClientMessage, ExtractMessage } from "./messages.js";
import { buildSessionPayload, withoutRecord, type SessionPayload, type StoredRecord, type TabSession } from "./session.js";
import { activeTabQuery, isWindowActiveTab, TabDebouncer } from "./window-session.js";

const SETTINGS_KEY = "settings";
const HISTORY_KEY = "history";
const USAGE_KEY = "usage";
const HISTORY_LIMIT = 30;

const tabs = new Map<number, TabSession>();
const inflight = new Map<number, string>();
const debounce = new TabDebouncer();
let historyChain: Promise<void> = Promise.resolve();

/** Reads settings and applies auto-off, so every path sees checks off once their time is up. */
async function readSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = parseSettings(stored[SETTINGS_KEY]);
  const guarded = applyAutoOff(settings, Date.now());
  if (guarded.checksEnabled !== settings.checksEnabled || guarded.checksOffAt !== settings.checksOffAt) {
    await writeSettings(guarded);
    if (!guarded.checksEnabled) void notifyUi(undefined);
  }
  return guarded;
}

async function readUsage(): Promise<DailyUsage> {
  const stored = await chrome.storage.local.get(USAGE_KEY);
  return parseUsage(stored[USAGE_KEY], Date.now());
}

let usageChain: Promise<void> = Promise.resolve();

function recordCheck(): Promise<void> {
  const next = usageChain.then(async () => {
    await chrome.storage.local.set({ [USAGE_KEY]: countCheck(await readUsage(), Date.now()) });
  });
  usageChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function writeSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

async function readHistory(): Promise<StoredRecord[]> {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  return Array.isArray(stored[HISTORY_KEY]) ? (stored[HISTORY_KEY] as StoredRecord[]) : [];
}

async function writeHistory(history: StoredRecord[]): Promise<void> {
  await chrome.storage.local.set({ [HISTORY_KEY]: history.slice(0, HISTORY_LIMIT) });
}

function appendHistory(record: StoredRecord): Promise<void> {
  const next = historyChain.then(async () => {
    const history = await readHistory();
    await writeHistory([record, ...withoutRecord(history, record.id)]);
  });
  historyChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function payload(definition: ApprovedDefinition, tabId: number | undefined): Promise<SessionPayload> {
  const settings = await readSettings();
  const history = await readHistory();
  const usage = await readUsage();
  return buildSessionPayload(definition, settings, history, tabId === undefined ? undefined : tabs.get(tabId), usage.checks);
}

async function tabIdInWindow(windowId?: number): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query(activeTabQuery(windowId));
  return tab?.id;
}

async function targetTabId(windowId: number | undefined, senderTabId: number | undefined): Promise<number | undefined> {
  if (windowId !== undefined) {
    const id = await tabIdInWindow(windowId);
    if (id !== undefined) return id;
  }
  if (senderTabId !== undefined) return senderTabId;
  return tabIdInWindow();
}

function browserLanguage(): string {
  return chrome.i18n?.getUILanguage?.() ?? "ja";
}

function uiLocale(settings: ExtensionSettings): ResolvedLocale {
  return resolveLocale(settings.locale, browserLanguage());
}

async function paint(definition: ApprovedDefinition, tabId: number | undefined): Promise<SessionPayload> {
  const next = await payload(definition, tabId);
  if (tabId !== undefined) {
    try {
      await applyActionIcon(tabId, next.view, uiLocale(next.settings));
    } catch {
      // The check must still finish even if the toolbar paint fails.
    }
  }
  return next;
}

async function notifyUi(session: SessionPayload | undefined, windowId?: number): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: "SESSION_UPDATED", session, windowId });
  } catch {
    return;
  }
}

async function publishForTab(definition: ApprovedDefinition, tabId: number): Promise<SessionPayload> {
  const session = await paint(definition, tabId);
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  if (tab?.windowId === undefined) return session;
  const activeId = await tabIdInWindow(tab.windowId);
  if (isWindowActiveTab(tabId, activeId)) await notifyUi(session, tab.windowId);
  return session;
}

async function paintActiveTabs(definition: ApprovedDefinition): Promise<void> {
  const windows = await chrome.windows.getAll();
  await Promise.all(
    windows.map(async (win) => {
      if (win.id === undefined) return;
      const id = await tabIdInWindow(win.id);
      if (id !== undefined) await paint(definition, id);
    }),
  );
}

async function extractTab(tabId: number, settings: ExtensionSettings): Promise<PageSnapshot> {
  const message: ExtractMessage = {
    type: "EXTRACT",
    minWords: settings.minWords,
  };
  const snapshot = (await chrome.tabs.sendMessage(tabId, message)) as PageSnapshot | { error: string };
  if (snapshot && typeof snapshot === "object" && "error" in snapshot) throw new Error(snapshot.error);
  return snapshot as PageSnapshot;
}

function errorMessage(error: unknown, locale: ResolvedLocale): string {
  const copy = copyFor(locale);
  if (error instanceof TypeSafeError) return copy.jevSendFailed;
  if (error instanceof Anthropic.APIError) return copy.claudeSendFailed;
  if (error instanceof ClaudeAnswerError) return copy.claudeAnswerFailed;
  if (error instanceof Error) {
    if (error.message.includes("Could not establish connection")) {
      return copy.extractFailed;
    }
    return error.message;
  }
  return unknownErrorMessage(error);
}

async function checkTab(definition: ApprovedDefinition, tabId: number, force: boolean, fromSidebarOpen = false): Promise<void> {
  const settings = await readSettings();
  const automatic = !force && !fromSidebarOpen;
  if (!settings.checksEnabled || (settings.checkOnlyWhenSidebarOpens && automatic)) return;
  if (setupGap(settings, definition.version) !== null) {
    await publishForTab(definition, tabId);
    return;
  }
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url ?? "";
  if (!isInspectableUrl(url)) {
    tabs.set(tabId, { status: "unsupported", url });
    await publishForTab(definition, tabId);
    return;
  }
  let snapshot: PageSnapshot;
  try {
    snapshot = await extractTab(tabId, settings);
  } catch (error) {
    tabs.set(tabId, { status: "error", message: errorMessage(error, uiLocale(settings)) });
    await publishForTab(definition, tabId);
    return;
  }
  const fingerprint = snapshotFingerprint(snapshot);
  const previous = tabs.get(tabId);
  if (!force && previous?.status === "ready" && previous.fingerprint === fingerprint) return;
  if (inflight.get(tabId) === fingerprint) return;
  // Only automatic checks stop at the daily limit; a check someone asked for still runs.
  if (automatic && dailyLimitReached(settings, await readUsage(), Date.now())) {
    await publishForTab(definition, tabId);
    return;
  }
  inflight.set(tabId, fingerprint);
  tabs.set(tabId, { status: "checking", snapshot, fingerprint });
  await publishForTab(definition, tabId);
  try {
    await recordCheck();
    const key = activeApiKey(settings);
    const gateway = settings.engine === "claude" ? createLiveClaude(key, settings.claudeModel) : createLiveJev(key);
    const report = {
      ...(await checkSnapshot(snapshot, definition, gateway)),
      engine: settings.engine === "claude" ? { id: "claude" as const, model: settings.claudeModel } : { id: "jev" as const },
    };
    const record: StoredRecord = {
      id: crypto.randomUUID(),
      tabId,
      snapshot,
      report,
      createdAt: new Date().toISOString(),
    };
    tabs.set(tabId, { status: "ready", record, fingerprint });
    await appendHistory(record);
  } catch (error) {
    tabs.set(tabId, { status: "error", message: errorMessage(error, uiLocale(settings)), snapshot, fingerprint });
  } finally {
    if (inflight.get(tabId) === fingerprint) inflight.delete(tabId);
  }
  await publishForTab(definition, tabId);
}

function schedule(definition: ApprovedDefinition, tabId: number, debounceMs: number): void {
  debounce.schedule(tabId, debounceMs, (id) => {
    void checkTab(definition, id, false);
  });
}

export function startBackground(definitionRaw: unknown): void {
  const definition = parseDefinition(definitionRaw);
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  void applyDefaultActionIcon({ status: "idle", followTab: true }).catch(() => undefined);
  void paintActiveTabs(definition);

  chrome.runtime.onInstalled.addListener(() => {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    void applyDefaultActionIcon({ status: "idle", followTab: true }).catch(() => undefined);
  });

  chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
    void (async () => {
      const settings = await readSettings();
      const session = await paint(definition, tabId);
      await notifyUi(session, windowId);
      if (settings.followTab) schedule(definition, tabId, settings.debounceMs);
    })();
  });

  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status !== "complete") return;
    void (async () => {
      const settings = await readSettings();
      if (settings.followTab) schedule(definition, tabId, settings.debounceMs);
    })();
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    tabs.delete(tabId);
    inflight.delete(tabId);
    debounce.cancel(tabId);
  });

  chrome.runtime.onMessage.addListener((message: ClientMessage, sender, sendResponse) => {
    const senderTabId = sender.tab?.id;
    const windowId = "windowId" in message ? message.windowId : undefined;
    void (async () => {
      try {
        if (message.type === "GET_SESSION") {
          sendResponse(await paint(definition, await targetTabId(windowId, senderTabId)));
          return;
        }
        if (message.type === "SIDEBAR_OPENED") {
          const id = await targetTabId(windowId, senderTabId);
          const settings = await readSettings();
          if (id !== undefined && settings.checkOnlyWhenSidebarOpens) {
            await checkTab(definition, id, false, true);
          }
          sendResponse(await payload(definition, id));
          return;
        }
        if (message.type === "SAVE_SETTINGS") {
          const next = parseSettings(message.settings);
          const previous = await readSettings();
          const merged = { ...DEFAULT_SETTINGS, ...previous, ...next, apiKey: next.apiKey, anthropicApiKey: next.anthropicApiKey };
          await writeSettings(settingsAfterSave(previous, merged, Date.now()));
          sendResponse(await payload(definition, await targetTabId(windowId, senderTabId)));
          await notifyUi(undefined);
          return;
        }
        if (message.type === "CHECK_NOW") {
          const id = await targetTabId(windowId, senderTabId);
          if (id === undefined) throw new Error(copyFor(uiLocale(await readSettings())).noTargetTab);
          const current = await readSettings();
          if (current.checksEnabled) await writeSettings(extendAutoOff(current, Date.now()));
          await checkTab(definition, id, true);
          sendResponse(await payload(definition, id));
          return;
        }
        if (message.type === "OPEN_DETAILS") {
          const idTab = await targetTabId(windowId, senderTabId);
          const current = await payload(definition, idTab);
          const id = message.id ?? (current.view.status === "ready" ? current.view.record.id : undefined);
          const url = chrome.runtime.getURL(`/details.html${id ? `?id=${encodeURIComponent(id)}` : ""}`);
          await chrome.tabs.create(windowId === undefined ? { url } : { url, windowId });
          sendResponse({ ok: true });
          return;
        }
        if (message.type === "OPEN_HISTORY") {
          const url = chrome.runtime.getURL("/history.html");
          await chrome.tabs.create(windowId === undefined ? { url } : { url, windowId });
          sendResponse({ ok: true });
          return;
        }
        if (message.type === "DELETE_HISTORY") {
          const history = await readHistory();
          await writeHistory(withoutRecord(history, message.id));
          const session = await payload(definition, await targetTabId(windowId, senderTabId));
          sendResponse(session);
          await notifyUi(undefined);
          return;
        }
        if (message.type === "OPEN_OPTIONS") {
          await chrome.runtime.openOptionsPage();
          sendResponse({ ok: true });
          return;
        }
        if (message.type === "PAGE_CHANGED" && senderTabId !== undefined) {
          const settings = await readSettings();
          if (settings.followTab && settings.recheckOnChange) schedule(definition, senderTabId, settings.debounceMs);
          sendResponse({ ok: true });
          return;
        }
        sendResponse({ error: `unknown message ${message.type}` });
      } catch (error) {
        sendResponse({ error: errorMessage(error, uiLocale(await readSettings())) });
      }
    })();
    return true;
  });
}
