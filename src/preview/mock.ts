import { parseDefinition, replayGateway, type JevAnswer } from "../lib/checkkit.js";
import type { Bridge } from "../lib/bridge.js";
import type { PageSnapshot } from "../lib/page-state.js";
import { checkSnapshot } from "../lib/run-check.js";
import { DEFAULT_SETTINGS, parseSettings, type ExtensionSettings } from "../lib/settings.js";
import type { SessionPayload, StoredRecord } from "../lib/session.js";
import definitionRaw from "../../fixtures/page-credibility.checker.json";
import failReplay from "../../fixtures/replay/page-credibility-fail.json";
import passReplay from "../../fixtures/replay/page-credibility-pass.json";

interface ReplayFile {
  state: Omit<PageSnapshot, "extractedAt">;
  answers: Record<string, JevAnswer>;
  usage: { input_tokens: number; output_tokens: number };
}

function toSnapshot(state: Omit<PageSnapshot, "extractedAt">): PageSnapshot {
  return { ...state, extractedAt: "2026-09-20T00:00:00.000Z", textTruncated: state.textTruncated ?? false };
}

async function recordFrom(replay: ReplayFile, id: string): Promise<StoredRecord> {
  const snapshot = toSnapshot(replay.state);
  const report = await checkSnapshot(snapshot, definitionRaw, replayGateway(replay.answers, replay.usage));
  return { id, tabId: 1, snapshot, report, createdAt: "2026-09-20T00:00:00.000Z" };
}

export async function createPreviewBridge(scene: string): Promise<Bridge> {
  const passFile = passReplay as ReplayFile;
  const pass = await recordFrom(passFile, "preview-pass");
  const fail = await recordFrom(failReplay as ReplayFile, "preview-fail");
  const truncated = await recordFrom({ ...passFile, state: { ...passFile.state, textTruncated: true } }, "preview-truncated");
  let settings: ExtensionSettings = {
    ...DEFAULT_SETTINGS,
    apiKey: scene === "setup" ? "" : "sk-preview",
    approver: scene === "setup" ? "" : "preview",
    ackedVersion: scene === "setup" ? null : 3,
    followTab: true,
  };
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const payload = (): SessionPayload => {
    const parsed = parseSettings(settings);
    const questions = [...parseDefinition(definitionRaw).questions];
    if (scene === "setup" && (parsed.ackedVersion !== 3 || parsed.apiKey.trim() === "")) {
      return {
        view: {
          status: "needs-setup",
          reason: parsed.ackedVersion !== 3 ? "approval" : "api-key",
          definitionVersion: 3,
        },
        questions,
        history: [pass, fail, truncated],
        settings: parsed,
        definitionVersion: 3,
      };
    }
    return {
      view: { status: "ready", record: scene === "fail" ? fail : scene === "truncated" ? truncated : pass },
      questions,
      history: [pass, fail, truncated],
      settings: parsed,
      definitionVersion: 3,
    };
  };

  return {
    getSession: async () => payload(),
    saveSettings: async (next) => {
      settings = parseSettings(next);
      notify();
      return payload();
    },
    checkNow: async () => payload(),
    openDetails: async () => {
      window.location.hash = "#details";
    },
    openOptions: async () => {
      window.location.hash = "#options";
    },
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}
