import { useEffect, useState } from "react";
import type { Bridge } from "../lib/bridge.js";
import type { SessionPayload } from "../lib/session.js";
import { AppHeader } from "./bits.js";
import { SettingsForm } from "./SettingsForm.js";

export function OptionsApp({ bridge }: { bridge: Bridge }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void bridge
      .getSession()
      .then(setSession)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)));
    return bridge.subscribe(() => {
      void bridge.getSession().then(setSession);
    });
  }, [bridge]);

  if (session === null) {
    return (
      <>
        <AppHeader />
        <main className="shell wide">{error ?? "読み込み中…"}</main>
      </>
    );
  }

  return (
    <>
      <AppHeader meta={`Settings · v${session.definitionVersion}`} />
      <main className="shell wide">
        <SettingsForm
          settings={session.settings}
          questions={session.questions}
          definitionVersion={session.definitionVersion}
          onSave={async (settings) => {
            setSession(await bridge.saveSettings(settings));
          }}
        />
      </main>
    </>
  );
}
