import type { Bridge } from "../lib/bridge.js";
import type { SessionView, StoredRecord } from "../lib/session.js";
import { AppChrome } from "./AppChrome.js";
import { ReportView } from "./ReportView.js";
import { useBridgeSession } from "./useBridgeSession.js";
import { useCopy } from "./useLocale.js";

export function SidePanelApp({ bridge }: { bridge: Bridge }) {
  const { session, error, accept, fail } = useBridgeSession(bridge);
  const theme = session?.settings.theme;
  const locale = session?.settings.locale;

  if (session === null && error === null) {
    return (
      <AppChrome theme={theme} locale={locale}>
        <LoadingCopy />
      </AppChrome>
    );
  }

  return (
    <AppChrome meta={`v${session?.definitionVersion ?? "—"}`} theme={theme} locale={locale}>
      <PanelBody
        view={session?.view}
        error={error}
        onAudit={() => void bridge.checkNow().then(accept).catch(fail)}
        onDetails={() => void bridge.openDetails()}
        onSettings={() => void bridge.openOptions()}
      />
    </AppChrome>
  );
}

function LoadingCopy() {
  return useCopy().loading;
}

function PanelBody({
  view,
  error,
  onAudit,
  onDetails,
  onSettings,
}: {
  view: SessionView | undefined;
  error: string | null;
  onAudit: () => void;
  onDetails: () => void;
  onSettings: () => void;
}) {
  const copy = useCopy();
  const record: StoredRecord | null = view?.status === "ready" ? view.record : null;
  return (
    <>
      {error ? <p className="notice fail">{error}</p> : null}

      {view?.status === "needs-setup" ? (
        <div className="notice">
          {view.reason === "approval" ? copy.needApproval : copy.needApiKey}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" type="button" onClick={onSettings}>
              Settings
            </button>
          </div>
        </div>
      ) : null}

      {view?.status === "unsupported" ? <p className="notice">{copy.unsupported(view.url)}</p> : null}

      {view?.status === "idle" ? <p className="help">{view.followTab ? copy.idleFollow : copy.idleManual}</p> : null}

      {view?.status === "checking" ? (
        <p className="help">
          {copy.auditing} {view.snapshot.title || view.snapshot.hostname}
        </p>
      ) : null}

      {view?.status === "error" ? <p className="notice fail">{view.message}</p> : null}

      {record ? <ReportView record={record} compact /> : null}

      <div className="toolbar">
        <button className="btn" type="button" onClick={onAudit}>
          Audit
        </button>
        <button className="btn secondary" type="button" onClick={onDetails}>
          Report
        </button>
        <button className="btn secondary" type="button" onClick={onSettings}>
          Settings
        </button>
      </div>
    </>
  );
}
