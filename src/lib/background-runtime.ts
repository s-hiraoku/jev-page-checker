import { TypeSafeError } from "@typesafe-ai/sdk";
import { applyActionIcon } from "./action-icon.js";
import { parseDefinition, type ApprovedDefinition } from "./checkkit.js";
import { unknownErrorMessage } from "./errors.js";
import { isInspectableUrl, snapshotFingerprint, type PageSnapshot } from "./page-state.js";
import { checkSnapshot, createLiveJev } from "./run-check.js";
import { DEFAULT_SETTINGS, parseSettings, setupGap, type ExtensionSettings } from "./settings.js";
import type { ClientMessage, ExtractMessage } from "./messages.js";
import { buildSessionPayload, type SessionPayload, type StoredRecord, type TabSession } from "./session.js";

const SETTINGS_KEY = "settings";
const HISTORY_KEY = "history";
const HISTORY_LIMIT = 30;

const tabs = new Map<number, TabSession>();
const inflight = new Map<number, string>();
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let debounceTabId: number | undefined;

async function readSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return parseSettings(stored[SETTINGS_KEY]);
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

async function payload(definition: ApprovedDefinition, tabId: number | undefined): Promise<SessionPayload> {
  const settings = await readSettings();
  const history = await readHistory();
  return buildSessionPayload(definition, settings, history, tabId === undefined ? undefined : tabs.get(tabId));
}

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}

async function paint(definition: ApprovedDefinition, tabId: number | undefined): Promise<SessionPayload> {
  const next = await payload(definition, tabId);
  if (tabId !== undefined) {
    try {
      await applyActionIcon(tabId, next.view);
    } catch {
      // The check must still finish even if the toolbar paint fails.
    }
  }
  return next;
}

async function notifyUi(session: SessionPayload): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: "SESSION_UPDATED", session });
  } catch {
    return;
  }
}

async function publish(definition: ApprovedDefinition, checkedTabId?: number): Promise<SessionPayload> {
  const activeId = await activeTabId();
  if (checkedTabId !== undefined && checkedTabId !== activeId) {
    await paint(definition, checkedTabId);
  }
  const session = await paint(definition, activeId);
  await notifyUi(session);
  return session;
}

async function extractTab(tabId: number, settings: ExtensionSettings): Promise<PageSnapshot> {
  const message: ExtractMessage = {
    type: "EXTRACT",
    maxChars: settings.maxChars,
    minWords: settings.minWords,
  };
  const snapshot = (await chrome.tabs.sendMessage(tabId, message)) as PageSnapshot | { error: string };
  if (snapshot && typeof snapshot === "object" && "error" in snapshot) throw new Error(snapshot.error);
  return snapshot as PageSnapshot;
}

function errorMessage(error: unknown): string {
  if (error instanceof TypeSafeError) return "Jev への送信に失敗しました。キーとネットワークを確認してください。";
  if (error instanceof Error && error.message.includes("Could not establish connection")) {
    return "このページからは本文を取れません。再読み込みしてから検査してください。";
  }
  return unknownErrorMessage(error);
}

async function checkTab(definition: ApprovedDefinition, tabId: number, force: boolean): Promise<void> {
  const settings = await readSettings();
  if (setupGap(settings, definition.version) !== null) {
    await publish(definition, tabId);
    return;
  }
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url ?? "";
  if (!isInspectableUrl(url)) {
    tabs.set(tabId, { status: "unsupported", url });
    await publish(definition, tabId);
    return;
  }
  let snapshot: PageSnapshot;
  try {
    snapshot = await extractTab(tabId, settings);
  } catch (error) {
    tabs.set(tabId, { status: "error", message: errorMessage(error) });
    await publish(definition, tabId);
    return;
  }
  const fingerprint = snapshotFingerprint(snapshot);
  const previous = tabs.get(tabId);
  if (!force && previous?.status === "ready" && previous.fingerprint === fingerprint) return;
  if (inflight.get(tabId) === fingerprint) return;
  inflight.set(tabId, fingerprint);
  tabs.set(tabId, { status: "checking", snapshot, fingerprint });
  await publish(definition, tabId);
  try {
    const report = await checkSnapshot(snapshot, definition, createLiveJev(settings.apiKey.trim()));
    const record: StoredRecord = {
      id: crypto.randomUUID(),
      tabId,
      snapshot,
      report,
      createdAt: new Date().toISOString(),
    };
    tabs.set(tabId, { status: "ready", record, fingerprint });
    const history = await readHistory();
    await writeHistory([record, ...history.filter((item) => item.id !== record.id)]);
  } catch (error) {
    tabs.set(tabId, { status: "error", message: errorMessage(error), snapshot, fingerprint });
  } finally {
    if (inflight.get(tabId) === fingerprint) inflight.delete(tabId);
  }
  await publish(definition, tabId);
}

function schedule(definition: ApprovedDefinition, tabId: number, debounceMs: number): void {
  debounceTabId = tabId;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (debounceTabId !== undefined) void checkTab(definition, debounceTabId, false);
  }, debounceMs);
}

export function startBackground(definitionRaw: unknown): void {
  const definition = parseDefinition(definitionRaw);
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  void activeTabId().then((tabId) => paint(definition, tabId));

  chrome.runtime.onInstalled.addListener(() => {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  });

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    void (async () => {
      const settings = await readSettings();
      await paint(definition, tabId);
      if (settings.followTab) schedule(definition, tabId, settings.debounceMs);
      else await notifyUi(await paint(definition, tabId));
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
  });

  chrome.runtime.onMessage.addListener((message: ClientMessage, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    void (async () => {
      try {
        if (message.type === "GET_SESSION") {
          sendResponse(await paint(definition, (await activeTabId()) ?? tabId));
          return;
        }
        if (message.type === "SAVE_SETTINGS") {
          const next = parseSettings(message.settings);
          const previous = await readSettings();
          await writeSettings({ ...DEFAULT_SETTINGS, ...previous, ...next, apiKey: next.apiKey, approver: next.approver });
          sendResponse(await publish(definition));
          return;
        }
        if (message.type === "CHECK_NOW") {
          const id = (await activeTabId()) ?? tabId;
          if (id === undefined) throw new Error("検査するタブがありません。");
          await checkTab(definition, id, true);
          sendResponse(await payload(definition, id));
          return;
        }
        if (message.type === "OPEN_DETAILS") {
          const current = await payload(definition, await activeTabId());
          const id = message.id ?? (current.view.status === "ready" ? current.view.record.id : undefined);
          const url = chrome.runtime.getURL(`/details.html${id ? `?id=${encodeURIComponent(id)}` : ""}`);
          await chrome.tabs.create({ url });
          sendResponse({ ok: true });
          return;
        }
        if (message.type === "OPEN_OPTIONS") {
          await chrome.runtime.openOptionsPage();
          sendResponse({ ok: true });
          return;
        }
        if (message.type === "PAGE_CHANGED" && tabId !== undefined) {
          const settings = await readSettings();
          if (settings.followTab && settings.recheckOnChange) schedule(definition, tabId, settings.debounceMs);
          sendResponse({ ok: true });
          return;
        }
        sendResponse({ error: `unknown message ${message.type}` });
      } catch (error) {
        sendResponse({ error: errorMessage(error) });
      }
    })();
    return true;
  });
}
