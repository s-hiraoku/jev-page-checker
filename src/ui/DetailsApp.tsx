import { useMemo } from "react";
import { recordById, type Bridge } from "../lib/bridge.js";
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
  return (
    <AppChrome wide meta={`v${session.definitionVersion}`} theme={theme} locale={locale}>
      <DetailsBody record={record} />
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

function DetailsBody({ record }: { record: ReturnType<typeof recordById> }) {
  const copy = useCopy();
  const locale = useLocale();
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
    </>
  );
}
