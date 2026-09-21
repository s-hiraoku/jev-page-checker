import { useMemo } from "react";
import { recordById, type Bridge } from "../lib/bridge.js";
import { bodySendKind } from "../lib/groups.js";
import { downloadTextFile, reportDocument, reportFilename } from "../lib/report-file.js";
import type { StoredRecord } from "../lib/session.js";
import { AppChrome } from "./AppChrome.js";
import { ReportView } from "./ReportView.js";
import { useBridgeSession } from "./useBridgeSession.js";
import { useCopy, useLocale } from "./useLocale.js";

function requestedId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

export function DetailsApp({ bridge }: { bridge: Bridge }) {
  const { session, error } = useBridgeSession(bridge);
  const id = useMemo(() => requestedId(), []);
  const theme = session?.settings.theme;
  const locale = session?.settings.locale;

  if (session === null) {
    return (
      <AppChrome wide theme={theme} locale={locale}>
        <LoadingCopy fallback={error} />
      </AppChrome>
    );
  }
  const record = recordById(session.history, id);
  const kind = bodySendKind(record?.report.inspection);

  return (
    <AppChrome wide meta={`Report · v${session.definitionVersion}`} theme={theme} locale={locale}>
      <DetailsBody record={record} kind={kind} />
    </AppChrome>
  );
}

function saveRecord(record: StoredRecord, locale: ReturnType<typeof useLocale>): void {
  downloadTextFile(reportFilename(record), reportDocument(record, locale));
}

function LoadingCopy({ fallback }: { fallback: string | null }) {
  const copy = useCopy();
  return fallback ?? copy.loading;
}

function DetailsBody({
  record,
  kind,
}: {
  record: ReturnType<typeof recordById>;
  kind: ReturnType<typeof bodySendKind>;
}) {
  const copy = useCopy();
  const locale = useLocale();
  const sentLabel = kind === "unread" ? copy.sentUnread : kind === "chunked" ? copy.sentChunked : copy.sentBody;
  return (
    <>
      <p className="help">{copy.detailsHelp}</p>
      {record ? (
        <div className="toolbar">
          <button type="button" className="btn secondary" onClick={() => saveRecord(record, locale)}>
            {copy.saveOnDevice}
          </button>
        </div>
      ) : null}
      {record ? <ReportView record={record} /> : <p className="notice">{copy.noResult}</p>}
      {record ? (
        <section className="panel">
          <div className="panel-head">{sentLabel}</div>
          <div className="panel-body">
            <p className="help">{record.snapshot.text}</p>
          </div>
        </section>
      ) : null}
    </>
  );
}
