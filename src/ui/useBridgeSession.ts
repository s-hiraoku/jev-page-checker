import { useCallback, useEffect, useState } from "react";
import type { Bridge } from "../lib/bridge.js";
import { unknownErrorMessage } from "../lib/errors.js";
import type { SessionPayload } from "../lib/session.js";

export function useBridgeSession(bridge: Bridge) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback((next: SessionPayload) => {
    setSession(next);
    setError(null);
  }, []);

  const fail = useCallback((caught: unknown) => {
    setError(unknownErrorMessage(caught));
  }, []);

  const refresh = useCallback(() => bridge.getSession().then(accept).catch(fail), [accept, bridge, fail]);

  useEffect(() => {
    void refresh();
    return bridge.subscribe(() => {
      void refresh();
    });
  }, [bridge, refresh]);

  return { session, error, accept, fail, refresh };
}
