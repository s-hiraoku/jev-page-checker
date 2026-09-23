import { useEffect, useState } from "react";
import type { Bridge } from "../lib/bridge.js";
import { DetailsApp } from "../ui/DetailsApp.js";
import { HistoryApp } from "../ui/HistoryApp.js";
import { OptionsApp } from "../ui/OptionsApp.js";
import { SidePanelApp } from "../ui/SidePanelApp.js";
import { createPreviewBridge } from "./mock.js";

const FIXTURES = [
  ["pass", "Pass"],
  ["fail", "Fail"],
  ["essay", "Essay"],
  ["portal", "Listing"],
  ["truncated", "Truncated"],
  ["chunked", "Chunked"],
] as const;

function pageFromHash(): "side" | "options" | "details" | "history" {
  if (window.location.hash === "#options") return "options";
  if (window.location.hash === "#details") return "details";
  if (window.location.hash === "#history") return "history";
  if (window.location.hash && window.location.hash !== "#side") return "details";
  return "side";
}

export function PreviewApp() {
  const params = new URLSearchParams(window.location.search);
  const store = params.get("store") === "1";
  const [scene, setScene] = useState(() => params.get("scene") ?? "pass");
  const [page, setPage] = useState(pageFromHash);
  const [bridge, setBridge] = useState<Bridge | null>(null);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void createPreviewBridge(scene).then((next) => {
      if (!cancelled) setBridge(next);
    });
    return () => {
      cancelled = true;
    };
  }, [scene]);

  const panel = (
    <>
      {bridge === null ? <p className="shell">Building preview…</p> : null}
      {bridge !== null && page === "side" ? (
        <div className={store ? "preview-frame store-panel" : "preview-frame"}>
          <SidePanelApp bridge={bridge} />
        </div>
      ) : null}
      {bridge !== null && page === "options" ? <OptionsApp bridge={bridge} /> : null}
      {bridge !== null && page === "details" ? <DetailsApp bridge={bridge} /> : null}
      {bridge !== null && page === "history" ? <HistoryApp bridge={bridge} /> : null}
    </>
  );

  if (store && page === "side") {
    return (
      <div className="store-layout">
        <section className="store-article">
          <p className="kicker">{scene === "fail" ? "販売ページの例" : scene === "essay" ? "エッセイの例" : scene === "portal" ? "一覧ページの例" : "報道ページの例"}</p>
          <h1>
            {scene === "fail"
              ? "Doctors hate this: one pill reverses aging in 11 days"
              : scene === "essay"
                ? "Why types beat guesswork"
                : scene === "portal"
                  ? "Example News"
                  : "City delays river bridge opening after inspection"}
          </h1>
          <p>
            {scene === "fail"
              ? "販売ページの例。発行元も出典もなく、数字が食い違う。Inspector はサイトと本文を分ける。"
              : scene === "essay"
                ? "意見の例。主張と、自分の実行結果と、意見だと分かる箇所がある。"
                : scene === "portal"
                  ? "一覧の例。見出しが並び、分類する一本の本文はない。"
                  : "報道ページの例。発行元と著者とメモへのリンクがある。点数は一つにしない。"}
          </p>
        </section>
        {panel}
      </div>
    );
  }

  if (store) return <div>{panel}</div>;

  return (
    <div>
      <div className="preview-bar">
        <nav className="preview-harness" aria-label="Preview fixtures">
          {FIXTURES.map(([id, label]) => (
            <button key={id} className={scene === id ? "btn" : "btn secondary"} type="button" onClick={() => setScene(id)}>
              {label}
            </button>
          ))}
        </nav>
        <nav className="preview-chrome" aria-label="App views">
          <button className={scene === "setup" ? "btn" : "btn secondary"} type="button" onClick={() => setScene("setup")}>
            Setup
          </button>
          <button className={page === "side" ? "btn" : "btn secondary"} type="button" onClick={() => { window.location.hash = "#side"; setPage("side"); }}>
            Inspector
          </button>
          <button className={page === "options" ? "btn" : "btn secondary"} type="button" onClick={() => { window.location.hash = "#options"; setPage("options"); }}>
            Settings
          </button>
          <button className={page === "details" ? "btn" : "btn secondary"} type="button" onClick={() => { window.location.hash = "#details"; setPage("details"); }}>
            Report
          </button>
          <button className={page === "history" ? "btn" : "btn secondary"} type="button" onClick={() => { window.location.hash = "#history"; setPage("history"); }}>
            History
          </button>
        </nav>
      </div>
      {panel}
    </div>
  );
}
