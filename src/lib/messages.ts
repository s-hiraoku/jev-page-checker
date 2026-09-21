import type { SessionPayload } from "./session.js";

export type ClientMessage =
  | { type: "GET_SESSION" }
  | { type: "CHECK_NOW" }
  | { type: "SAVE_SETTINGS"; settings: unknown }
  | { type: "OPEN_DETAILS"; id?: string }
  | { type: "OPEN_OPTIONS" }
  | { type: "PAGE_CHANGED"; fingerprint: string };

export type ExtractMessage = { type: "EXTRACT"; minWords: number };

export type ServerMessage = { type: "SESSION_UPDATED"; session: SessionPayload };

export function isExtractMessage(message: unknown): message is ExtractMessage {
  if (message === null || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "EXTRACT" && typeof record.minWords === "number";
}
