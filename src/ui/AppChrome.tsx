import type { ReactNode } from "react";
import { AppHeader } from "./bits.js";

export function AppChrome({
  meta,
  wide = false,
  children,
}: {
  meta?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <AppHeader meta={meta} />
      <main className={wide ? "shell wide" : "shell"}>{children}</main>
    </>
  );
}
