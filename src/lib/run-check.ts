import { TypeSafeClient } from "@typesafe-ai/sdk";
import { evaluate, liveGateway, type ApprovedDefinition, type CheckReport, type JevGateway } from "./checkkit.js";
import { snapshotToState, type PageSnapshot } from "./page-state.js";

export function createLiveJev(apiKey: string): JevGateway {
  return liveGateway(
    () =>
      new TypeSafeClient({
        apiKey,
        logLevel: "off",
        dangerouslyAllowBrowser: true,
        timeout: 30_000,
      }),
  );
}

export async function checkSnapshot(snapshot: PageSnapshot, definition: ApprovedDefinition, jev: JevGateway): Promise<CheckReport> {
  return evaluate(definition, snapshotToState(snapshot), jev);
}
