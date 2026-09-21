import { useEffect, useMemo, useState } from "react";
import { recordById, type Bridge } from "../lib/bridge.js";
import type { SessionPayload } from "../lib/session.js";
import { ReportView } from "./ReportView.js";

function requestedId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

export function DetailsApp({ bridge }: { bridge: Bridge }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useMemo(() => requestedId(), []);

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
        <header className="app-header">
          <div className="app-name">Jev 信憑性チェッカー</div>
        </header>
        <main className="shell wide">{error ?? "読み込み中…"}</main>
      </>
    );
  }
  const record = recordById(session.history, id);

  return (
    <>
      <header className="app-header">
        <div className="app-name">Jev 信憑性チェッカー</div>
        <div className="app-meta">詳細 / 定義 v{session.definitionVersion}</div>
      </header>
      <main className="shell wide">
        <div>
          <h1 className="page-title">検査の詳細</h1>
          <p className="help">保存したレポートは判断材料です。ここから公開や送信はできません。</p>
        </div>
        {record ? <ReportView record={record} /> : <p className="notice">まだ検査結果がありません。側面パネルから今のタブを検査してください。</p>}
        {record ? (
          <section className="panel">
            <div className="panel-head">{record.snapshot.textTruncated ? "送った本文（先頭のみ）" : "送った本文"}</div>
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
      </main>
    </>
  );
}
