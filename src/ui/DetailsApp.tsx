import { useMemo } from "react";
import { recordById, type Bridge } from "../lib/bridge.js";
import { AppChrome } from "./AppChrome.js";
import { ReportView } from "./ReportView.js";
import { useBridgeSession } from "./useBridgeSession.js";

function requestedId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

export function DetailsApp({ bridge }: { bridge: Bridge }) {
  const { session, error } = useBridgeSession(bridge);
  const id = useMemo(() => requestedId(), []);

  if (session === null) {
    return <AppChrome wide>{error ?? "読み込み中…"}</AppChrome>;
  }
  const record = recordById(session.history, id);

  return (
    <AppChrome wide meta={`詳細 / 定義 v${session.definitionVersion}`}>
      <div>
        <h1 className="page-title">検査の詳細</h1>
        <p className="help">保存したレポートは判断材料です。ここから公開や送信はできません。</p>
      </div>
      {record ? <ReportView record={record} /> : <p className="notice">まだ検査結果がありません。側面パネルから今のタブを検査してください。</p>}
      {record ? (
        <section className="panel">
          <div className="panel-head">送った本文</div>
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
