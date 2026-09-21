import { replayGateway, type ApprovedDefinition, type JevAnswer } from "./checkkit.js";
import type { PageSnapshot } from "./page-state.js";
import { checkSnapshot } from "./run-check.js";

export const REPLAY_CLOCK = "2026-09-20T00:00:00.000Z";

export interface ReplayFixture {
  state: Omit<PageSnapshot, "extractedAt">;
  answers: Record<string, JevAnswer>;
  usage: { input_tokens: number; output_tokens: number };
}

export function snapshotFromReplay(state: Omit<PageSnapshot, "extractedAt">): PageSnapshot {
  return {
    ...state,
    extractedAt: REPLAY_CLOCK,
    textTruncated: state.textTruncated ?? false,
  };
}

export function checkReplay(definition: ApprovedDefinition, replay: ReplayFixture) {
  return checkSnapshot(snapshotFromReplay(replay.state), definition, replayGateway(replay.answers, replay.usage));
}
