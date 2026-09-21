import { useEffect, useState } from "react";
import type { Bridge } from "../lib/bridge.js";
import { DetailsApp } from "../ui/DetailsApp.js";
import { OptionsApp } from "../ui/OptionsApp.js";
import { SidePanelApp } from "../ui/SidePanelApp.js";
import { createPreviewBridge } from "./mock.js";

const SCENES = [
  ["pass", "Pass"],
  ["fail", "Fail"],
  ["setup", "Setup"],
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
      <div style={{ display: "flex", minHeight: "100vh", background: "#eceff3" }}>
        <section style={{ flex: 1, padding: 32, color: "#111827" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#4b5563" }}>{scene === "fail" ? "販売ページの例" : "報道ページの例"}</p>
          <h1 style={{ fontSize: 22, margin: "8px 0 16px" }}>
            {scene === "fail" ? "Doctors hate this: one pill reverses aging in 11 days" : "City delays river bridge opening after inspection"}
          </h1>
          <p style={{ maxWidth: 560, color: "#4b5563" }}>
            {scene === "fail"
              ? "販売ページの例。発行元も出典もなく、数字が食い違う。Inspector はサイトと本文を分ける。"
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
      <nav className="preview-nav">
        {SCENES.map(([id, label]) => (
          <button key={id} className={scene === id ? "btn" : "btn secondary"} type="button" onClick={() => setScene(id)}>
            {label}
          </button>
        ))}
        <button className={page === "side" ? "btn" : "btn secondary"} type="button" onClick={() => { window.location.hash = "#side"; setPage("side"); }}>
          Inspector
        </button>
        <button className={page === "options" ? "btn" : "btn secondary"} type="button" onClick={() => { window.location.hash = "#options"; setPage("options"); }}>
          Settings
        </button>
        <button className={page === "details" ? "btn" : "btn secondary"} type="button" onClick={() => { window.location.hash = "#details"; setPage("details"); }}>
          Report
        </button>
      </nav>
      {panel}
    </div>
  );
}
