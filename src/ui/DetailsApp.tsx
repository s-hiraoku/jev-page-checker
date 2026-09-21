import { useMemo } from "react";
import { recordById, type Bridge } from "../lib/bridge.js";
import { bodySendKind } from "../lib/groups.js";
import { AppChrome } from "./AppChrome.js";
import { ReportView } from "./ReportView.js";
import { useBridgeSession } from "./useBridgeSession.js";

function requestedId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function sentLabel(kind: ReturnType<typeof bodySendKind>): string {
  if (kind === "unread") return "抽出した主本文（切れ残りあり）";
  if (kind === "chunked") return "抽出した主本文（分割して送信）";
  return "送った文";
}

export function DetailsApp({ bridge }: { bridge: Bridge }) {
  const { session, error } = useBridgeSession(bridge);
  const id = useMemo(() => requestedId(), []);

  if (session === null) {
    return <AppChrome wide>{error ?? "読み込み中…"}</AppChrome>;
  }
  const record = recordById(session.history, id);
  const kind = bodySendKind(record?.report.inspection);

  return (
    <AppChrome wide meta={`Report · v${session.definitionVersion}`}>
      <p className="help">判断材料。ここから公開も送信もしない。</p>
      {record ? <ReportView record={record} /> : <p className="notice">まだ結果がありません。Inspector から Audit してください。</p>}
      {record ? (
        <section className="panel">
          <div className="panel-head">{sentLabel(kind)}</div>
          <div className="panel-body">
            <p className="help">{record.snapshot.text}</p>
          </div>
        </section>
      ) : null}
      <section>
        <h2 className="page-title">履歴</h2>
        <div className="history">
          {session.history.map((item) => (
            <a key={item.id} href={`?id=${encodeURIComponent(item.id)}`}>
              <strong>{item.snapshot.title || item.snapshot.hostname}</strong>
              <div className="url">{item.snapshot.url}</div>
            </a>
          ))}
        </div>
      </section>
    </AppChrome>
  );
}
