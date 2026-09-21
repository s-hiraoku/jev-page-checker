import type { Bridge } from "../lib/bridge.js";
import { AppChrome } from "./AppChrome.js";
import { SettingsForm } from "./SettingsForm.js";
import { useBridgeSession } from "./useBridgeSession.js";

export function OptionsApp({ bridge }: { bridge: Bridge }) {
  const { session, error, accept } = useBridgeSession(bridge);

  if (session === null) {
    return <AppChrome wide>{error ?? "読み込み中…"}</AppChrome>;
  }

  return (
    <AppChrome wide meta={`Settings · v${session.definitionVersion}`}>
      <SettingsForm
        settings={session.settings}
        questions={session.questions}
        definitionVersion={session.definitionVersion}
        onSave={async (settings) => {
          accept(await bridge.saveSettings(settings));
        }}
      />
    </AppChrome>
  );
}
