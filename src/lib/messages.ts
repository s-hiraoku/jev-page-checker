import type { SessionPayload } from "./session.js";

export type ClientMessage =
  | { type: "GET_SESSION"; windowId?: number }
  | { type: "CHECK_NOW"; windowId?: number }
  | { type: "SAVE_SETTINGS"; settings: unknown; windowId?: number }
  | { type: "OPEN_DETAILS"; id?: string; windowId?: number }
  | { type: "OPEN_OPTIONS" }
  | { type: "PAGE_CHANGED"; fingerprint: string };

export type ExtractMessage = { type: "EXTRACT"; minWords: number };

export type ServerMessage = { type: "SESSION_UPDATED"; windowId?: number; session?: SessionPayload };

export function isSessionUpdated(message: unknown): message is ServerMessage {
  if (message === null || typeof message !== "object") return false;
  return (message as { type?: string }).type === "SESSION_UPDATED";
}

export function isExtractMessage(message: unknown): message is ExtractMessage {
  if (message === null || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "EXTRACT" && typeof record.minWords === "number";
}
