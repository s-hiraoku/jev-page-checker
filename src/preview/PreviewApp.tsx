import { useEffect, useState } from "react";
import type { Bridge } from "../lib/bridge.js";
import { DetailsApp } from "../ui/DetailsApp.js";
import { OptionsApp } from "../ui/OptionsApp.js";
import { SidePanelApp } from "../ui/SidePanelApp.js";
import { createPreviewBridge } from "./mock.js";

const SCENES = [
  ["pass", "通過例"],
  ["fail", "要警戒例"],
  ["setup", "初期設定"],
] as const;

function pageFromHash(): "side" | "options" | "details" {
  if (window.location.hash === "#options") return "options";
  if (window.location.hash === "#details") return "details";
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
      {bridge === null ? <p className="shell">プレビューを組み立てています…</p> : null}
      {bridge !== null && page === "side" ? (
        <div style={{ maxWidth: 380, minHeight: "100vh", borderLeft: store ? "1px solid var(--line)" : undefined }}>
          <SidePanelApp bridge={bridge} />
        </div>
      ) : null}
      {bridge !== null && page === "options" ? <OptionsApp bridge={bridge} /> : null}
      {bridge !== null && page === "details" ? <DetailsApp bridge={bridge} /> : null}
    </>
  );

  if (store && page === "side") {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#d9e1e8" }}>
        <section style={{ flex: 1, padding: 48, color: "#172033" }}>
          <p style={{ fontFamily: "Libre Baskerville, serif", letterSpacing: "0.14em", textTransform: "uppercase", fontSize: 12 }}>
            {scene === "fail" ? "example page" : "example news"}
          </p>
          <h1 style={{ fontSize: 36, margin: "8px 0 16px" }}>
            {scene === "fail" ? "Doctors hate this: one pill reverses aging in 11 days" : "City delays river bridge opening after inspection"}
          </h1>
          <p style={{ maxWidth: 560, color: "#5a6a78" }}>
            {scene === "fail"
              ? "販売ページの例です。発行元も出典も無く、数字が本文の中で食い違っています。側面パネルはサイトと本文を分けて見ます。"
              : "報道ページの例です。発行元、著者、検査メモへのリンクがあります。側面パネルは一つの点数にせず、質問ごとに判定します。"}
          </p>
        </section>
        {panel}
      </div>
    );
  }

  if (store) return <div>{panel}</div>;

  return (
    <div>
      <nav className="row" style={{ padding: 12, borderBottom: "1px solid var(--line)", background: "var(--card)" }}>
        {SCENES.map(([id, label]) => (
          <button key={id} className={scene === id ? "btn" : "btn secondary"} type="button" onClick={() => setScene(id)}>
            {label}
          </button>
        ))}
        <button className={page === "side" ? "btn" : "btn secondary"} type="button" onClick={() => { window.location.hash = "#side"; setPage("side"); }}>
          側面パネル
        </button>
        <button className={page === "options" ? "btn" : "btn secondary"} type="button" onClick={() => { window.location.hash = "#options"; setPage("options"); }}>
          設定
        </button>
        <button className={page === "details" ? "btn" : "btn secondary"} type="button" onClick={() => { window.location.hash = "#details"; setPage("details"); }}>
          詳細
        </button>
      </nav>
      {panel}
    </div>
  );
}
