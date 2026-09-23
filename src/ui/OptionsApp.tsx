import type { Bridge } from "../lib/bridge.js";
import { AppChrome } from "./AppChrome.js";
import { SettingsForm } from "./SettingsForm.js";
import { useBridgeSession } from "./useBridgeSession.js";
import { useCopy } from "./useLocale.js";

export function OptionsApp({ bridge }: { bridge: Bridge }) {
  const { session, error, accept } = useBridgeSession(bridge);
  const theme = session?.settings.theme;
  const locale = session?.settings.locale;

  if (session === null) {
    return (
      <AppChrome wide theme={theme} locale={locale}>
        <LoadingCopy fallback={error} />
      </AppChrome>
    );
  }

  return (
    <AppChrome wide meta={`v${session.definitionVersion}`} theme={theme} locale={locale}>
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

function LoadingCopy({ fallback }: { fallback: string | null }) {
  const copy = useCopy();
  return fallback ?? copy.loading;
}
