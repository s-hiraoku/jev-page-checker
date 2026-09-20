import type { ReactNode } from "react";

export function AppChrome({
  meta,
  wide = false,
  children,
}: {
  meta?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <header className="app-header">
        <div className="app-name">Jev 信憑性チェッカー</div>
        {meta != null && meta !== "" ? <div className="app-meta">{meta}</div> : null}
      </header>
      <main className={wide ? "shell wide" : "shell"}>{children}</main>
    </>
  );
}
