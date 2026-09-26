import { useEffect, useState } from "react";
import type { Bridge } from "../lib/bridge.js";
import type { SessionView, StoredRecord } from "../lib/session.js";
import { AppChrome } from "./AppChrome.js";
import { ReportView } from "./ReportView.js";
import { useBridgeSession } from "./useBridgeSession.js";
import { useCopy } from "./useLocale.js";

export function SidePanelApp({ bridge }: { bridge: Bridge }) {
  const { session, error, accept, fail } = useBridgeSession(bridge);
  const [settingsSaving, setSettingsSaving] = useState(false);
  useEffect(() => {
    void bridge.sidebarOpened().then(accept).catch(fail);
  }, [accept, bridge, fail]);
  const setChecksEnabled = (checksEnabled: boolean) => {
    if (!session || settingsSaving) return;
    setSettingsSaving(true);
    void bridge.saveSettings({ ...session.settings, checksEnabled })
      .then(accept)
      .catch(fail)
      .finally(() => setSettingsSaving(false));
  };
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
        checksEnabled={session?.settings.checksEnabled ?? true}
        settingsSaving={settingsSaving}
        error={error}
        onToggleChecks={setChecksEnabled}
        onAudit={() => void bridge.checkNow().then(accept).catch(fail)}
        onDetails={() => void bridge.openDetails()}
        onHistory={() => void bridge.openHistory()}
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
  checksEnabled,
  settingsSaving,
  error,
  onToggleChecks,
  onAudit,
  onDetails,
  onHistory,
  onSettings,
}: {
  view: SessionView | undefined;
  checksEnabled: boolean;
  settingsSaving: boolean;
  error: string | null;
  onToggleChecks: (enabled: boolean) => void;
  onAudit: () => void;
  onDetails: () => void;
  onHistory: () => void;
  onSettings: () => void;
}) {
  const copy = useCopy();
  const record: StoredRecord | null = view?.status === "ready" ? view.record : null;
  return (
    <>
      <div className="sidebar-check-setting">
        <label className="sidebar-check-switch">
          <input
            type="checkbox"
            role="switch"
            checked={checksEnabled}
            disabled={settingsSaving}
            onChange={(event) => onToggleChecks(event.target.checked)}
          />
          <span className="sidebar-check-track" aria-hidden="true"><span /></span>
          <span className="sidebar-check-copy">
            <strong>{copy.checksEnabled}</strong>
            <small>{copy.checksEnabledHelp}</small>
          </span>
        </label>
      </div>
      {error ? <p className="notice fail">{error}</p> : null}

      {view?.status === "needs-setup" ? (
        <div className="notice">
          {view.reason === "approval" ? copy.needApproval : copy.needApiKey}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" type="button" onClick={onSettings}>
              {copy.settings}
            </button>
          </div>
        </div>
      ) : null}

      {view?.status === "unsupported" ? <p className="notice">{copy.unsupported(view.url)}</p> : null}

      {!checksEnabled ? <p className="help">{copy.checksDisabled}</p> : null}
      {checksEnabled && view?.status === "idle" ? <p className="help">{view.followTab ? copy.idleFollow : copy.idleManual}</p> : null}

      {view?.status === "checking" ? (
        <p className="help">
          {copy.auditing} {view.snapshot.title || view.snapshot.hostname}
        </p>
      ) : null}

      {view?.status === "error" ? <p className="notice fail">{view.message}</p> : null}

      {record ? <ReportView record={record} compact /> : null}

      <div className="toolbar">
        <button className="btn" type="button" onClick={onAudit} disabled={!checksEnabled || settingsSaving}>
          {copy.audit}
        </button>
        <button className="btn secondary" type="button" onClick={onDetails}>
          {copy.report}
        </button>
        <button className="btn secondary" type="button" onClick={onHistory}>
          {copy.history}
        </button>
        <button className="btn secondary" type="button" onClick={onSettings}>
          {copy.settings}
        </button>
      </div>
    </>
  );
}
