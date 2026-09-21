import { useEffect, useState } from "react";
import type { Bridge } from "../lib/bridge.js";
import { DEFAULT_SETTINGS } from "../lib/settings.js";
import type { SessionPayload } from "../lib/session.js";
import { AppHeader } from "./bits.js";
import { ReportView } from "./ReportView.js";

export function SidePanelApp({ bridge }: { bridge: Bridge }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    bridge
      .getSession()
      .then((next) => {
        setSession(next);
        setError(null);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)));

  useEffect(() => {
    void refresh();
    return bridge.subscribe(() => {
      void refresh();
    });
  }, [bridge]);

  if (session === null && error === null) {
    return (
      <>
        <AppHeader />
        <main className="shell">読み込み中…</main>
      </>
    );
  }
  const view = session?.view;

  return (
    <>
      <AppHeader meta={`v${session?.definitionVersion ?? "—"}`} />
      <main className="shell">
        <p className="help">サイトと本文を分ける。一つの点数にはしない。</p>

        {error ? <p className="notice fail">{error}</p> : null}

        {view?.status === "needs-setup" ? (
          <div className="notice">
            {view.reason === "approval" ? "チェックリスト全体の承認が先。" : "TypeSafe の API キーがまだない。"}
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn" type="button" onClick={() => void bridge.openOptions()}>
                設定
              </button>
            </div>
          </div>
        ) : null}

        {view?.status === "unsupported" ? (
          <p className="notice">http(s) だけ。いまの URL は {view.url || "（不明）"}。</p>
        ) : null}

        {view?.status === "idle" ? (
          <p className="help">{view.followTab ? "タブを開くと自動で裏を取る。" : "追跡オフ。必要なときだけ。"}</p>
        ) : null}

        {view?.status === "checking" ? (
          <p className="help">裏取り中… {view.snapshot.title || view.snapshot.hostname}</p>
        ) : null}

        {view?.status === "error" ? <p className="notice fail">{view.message}</p> : null}

        {view?.status === "ready" ? <ReportView record={view.record} compact /> : null}

        <div className="toolbar">
          <button
            className="btn"
            type="button"
            onClick={() =>
              void bridge
                .checkNow()
                .then(setSession)
                .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)))
            }
          >
            裏を取る
          </button>
          <button className="btn secondary" type="button" onClick={() => void bridge.openDetails()}>
            記録
          </button>
          <button className="btn secondary" type="button" onClick={() => void bridge.openOptions()}>
            設定
          </button>
        </div>
        <p className="foot">
          アイコン上段がサイト、下段が本文。根拠であり遮断しない。追跡{" "}
          {session?.settings.followTab ?? DEFAULT_SETTINGS.followTab ? "オン" : "オフ"}
        </p>
      </main>
    </>
  );
}
