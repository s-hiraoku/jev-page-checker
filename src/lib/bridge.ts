import type { ExtensionSettings } from "./settings.js";
import { isSessionUpdated, type ServerMessage } from "./messages.js";
import type { SessionPayload, StoredRecord } from "./session.js";
import { sessionUpdateApplies } from "./window-session.js";

export interface Bridge {
  getSession(): Promise<SessionPayload>;
  saveSettings(settings: ExtensionSettings): Promise<SessionPayload>;
  checkNow(): Promise<SessionPayload>;
  openDetails(id?: string): Promise<void>;
  openHistory(): Promise<void>;
  openOptions(): Promise<void>;
  subscribe(onChange: (session?: SessionPayload) => void): () => void;
}

async function callerWindowId(): Promise<number | undefined> {
  try {
    const current = await chrome.windows.getCurrent();
    return current.id;
  } catch {
    return undefined;
  }
}

export function liveBridge(options?: { isolateWindow?: boolean }): Bridge {
  const isolateWindow = options?.isolateWindow === true;
  const send = async <T>(message: object): Promise<T> => {
    const windowId = await callerWindowId();
    const reply = (await chrome.runtime.sendMessage(
      windowId === undefined ? message : { ...message, windowId },
    )) as T | { error?: string };
    if (reply && typeof reply === "object" && "error" in reply && reply.error) throw new Error(reply.error);
    return reply as T;
  };
  return {
    getSession: () => send<SessionPayload>({ type: "GET_SESSION" }),
    saveSettings: (settings) => send<SessionPayload>({ type: "SAVE_SETTINGS", settings }),
    checkNow: () => send<SessionPayload>({ type: "CHECK_NOW" }),
    openDetails: async (id) => {
      await send({ type: "OPEN_DETAILS", id });
    },
    openHistory: async () => {
      await send({ type: "OPEN_HISTORY" });
    },
    openOptions: async () => {
      await send({ type: "OPEN_OPTIONS" });
    },
    subscribe: (onChange) => {
      const listener = (message: ServerMessage | { type?: string }) => {
        if (!isSessionUpdated(message)) return;
        void callerWindowId().then((viewerWindowId) => {
          if (!sessionUpdateApplies(message.windowId, viewerWindowId, isolateWindow)) return;
          onChange(message.session);
        });
      };
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    },
  };
}

export function recordById(history: readonly StoredRecord[], id: string | null): StoredRecord | undefined {
  if (id === null) return history[0];
  return history.find((record) => record.id === id) ?? history[0];
}
