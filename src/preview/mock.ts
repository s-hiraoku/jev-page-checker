import { parseDefinition } from "../lib/checkkit.js";
import type { Bridge } from "../lib/bridge.js";
import { checkReplay, REPLAY_CLOCK, snapshotFromReplay, type ReplayFixture } from "../lib/replay.js";
import { DEFAULT_SETTINGS, parseSettings, setupGap, type ExtensionSettings } from "../lib/settings.js";
import { buildSessionPayload, type SessionPayload, type StoredRecord } from "../lib/session.js";
import definitionRaw from "../../fixtures/page-credibility.checker.json";
import failReplay from "../../fixtures/replay/page-credibility-fail.json";
import passReplay from "../../fixtures/replay/page-credibility-pass.json";

const definition = parseDefinition(definitionRaw);

async function recordFrom(replay: ReplayFixture, id: string): Promise<StoredRecord> {
  return {
    id,
    tabId: 1,
    snapshot: snapshotFromReplay(replay.state),
    report: await checkReplay(definition, replay),
    createdAt: REPLAY_CLOCK,
  };
}

export async function createPreviewBridge(scene: string): Promise<Bridge> {
  const pass = await recordFrom(passReplay as ReplayFixture, "preview-pass");
  const fail = await recordFrom(failReplay as ReplayFixture, "preview-fail");
  let settings: ExtensionSettings = {
    ...DEFAULT_SETTINGS,
    apiKey: scene === "setup" ? "" : "sk-preview",
    approver: scene === "setup" ? "" : "preview",
    ackedVersion: scene === "setup" ? null : definition.version,
    followTab: true,
  };
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const payload = (): SessionPayload => {
    const parsed = parseSettings(settings);
    const gap = setupGap(parsed, definition.version);
    if (scene === "setup" && gap !== null) {
      return buildSessionPayload(definition, parsed, [pass, fail], undefined);
    }
    return buildSessionPayload(definition, parsed, [pass, fail], {
      status: "ready",
      record: scene === "fail" ? fail : pass,
      fingerprint: "",
    });
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
