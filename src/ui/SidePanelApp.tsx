import type { Bridge } from "../lib/bridge.js";
import { DEFAULT_SETTINGS } from "../lib/settings.js";
import { AppChrome } from "./AppChrome.js";
import { ReportView } from "./ReportView.js";
import { useBridgeSession } from "./useBridgeSession.js";

export function SidePanelApp({ bridge }: { bridge: Bridge }) {
  const { session, error, accept, fail } = useBridgeSession(bridge);

  if (session === null && error === null) {
    return (
      <AppChrome>
        読み込み中…
      </AppChrome>
    );
  }
  const view = session?.view;

  return (
    <AppChrome meta={`定義 v${session?.definitionVersion ?? "—"}`}>
      <div>
        <h1 className="page-title">検査</h1>
        <p className="help">サイトの安全性と、記事本文があるときだけの精査を分けます。点数は一つにまとめません。</p>
      </div>

      {error ? <p className="notice fail">{error}</p> : null}

      {view?.status === "needs-setup" ? (
        <div className="notice">
          {view.reason === "approval"
            ? "設定でチェックリスト全体を承認するまで検査しません。"
            : "TypeSafe の API キーがまだありません。"}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" type="button" onClick={() => void bridge.openOptions()}>
              設定を開く
            </button>
          </div>
        </div>
      ) : null}

      {view?.status === "unsupported" ? (
        <p className="notice">http(s) のページだけを検査します。今の URL は {view.url || "（不明）"} です。</p>
      ) : null}

      {view?.status === "idle" ? (
        <p className="help">{view.followTab ? "タブを開くと自動で検査します。" : "追跡はオフです。必要なときに検査してください。"}</p>
      ) : null}

      {view?.status === "checking" ? (
        <p className="help">検査中… {view.snapshot.title || view.snapshot.hostname}</p>
      ) : null}

      {view?.status === "error" ? <p className="notice fail">{view.message}</p> : null}

      {view?.status === "ready" ? <ReportView record={view.record} compact /> : null}

      <div className="toolbar">
        <button
          className="btn"
          type="button"
          onClick={() => void bridge.checkNow().then(accept).catch(fail)}
        >
          今のタブを検査
        </button>
        <button className="btn secondary" type="button" onClick={() => void bridge.openDetails()}>
          詳細
        </button>
        <button className="btn secondary" type="button" onClick={() => void bridge.openOptions()}>
          設定
        </button>
      </div>
      <p className="foot">
        常駐アイコンの上段がサイト、下段が本文です。判定は根拠であり、遮断や送信はしません。追跡{" "}
        {session?.settings.followTab ?? DEFAULT_SETTINGS.followTab ? "オン" : "オフ"}
      </p>
    </AppChrome>
  );
}
