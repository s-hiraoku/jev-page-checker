import type { Bridge } from "../lib/bridge.js";
import type { StoredRecord } from "../lib/session.js";
import { AppChrome } from "./AppChrome.js";
import { useBridgeSession } from "./useBridgeSession.js";
import { useCopy } from "./useLocale.js";

export function HistoryApp({ bridge }: { bridge: Bridge }) {
  const { session, error } = useBridgeSession(bridge);
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
    <AppChrome wide meta={`History · v${session.definitionVersion}`} theme={theme} locale={locale}>
      <HistoryBody history={session.history} onOpen={(id) => void bridge.openDetails(id)} />
    </AppChrome>
  );
}

function LoadingCopy({ fallback }: { fallback: string | null }) {
  const copy = useCopy();
  return fallback ?? copy.loading;
}

function HistoryBody({ history, onOpen }: { history: StoredRecord[]; onOpen: (id: string) => void }) {
  const copy = useCopy();
  return (
    <>
      <h2 className="page-title">{copy.history}</h2>
      <p className="help">{copy.historyHelp}</p>
      {history.length === 0 ? <p className="notice">{copy.historyEmpty}</p> : null}
      <div className="history">
        {history.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.snapshot.title || item.snapshot.hostname}
            onClick={() => onOpen(item.id)}
          >
            <strong>{item.snapshot.title || item.snapshot.hostname}</strong>
            <div className="url">{item.snapshot.url}</div>
          </button>
        ))}
      </div>
    </>
  );
}
