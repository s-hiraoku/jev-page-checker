import { useEffect, useMemo, useState } from "react";
import { recordById, type Bridge } from "../lib/bridge.js";
import type { SessionPayload } from "../lib/session.js";
import { AppHeader } from "./bits.js";
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
        <AppHeader />
        <main className="shell wide">{error ?? "読み込み中…"}</main>
      </>
    );
  }
  const record = recordById(session.history, id);

  return (
    <>
      <AppHeader meta={`Report · v${session.definitionVersion}`} />
      <main className="shell wide">
        <p className="help">判断材料。ここから公開も送信もしない。</p>
        {record ? <ReportView record={record} /> : <p className="notice">まだ結果がありません。Inspector から Audit してください。</p>}
        {record ? (
          <section className="panel">
            <div className="panel-head">送った文</div>
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
