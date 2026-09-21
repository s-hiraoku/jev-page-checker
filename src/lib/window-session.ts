export function activeTabQuery(
  windowId?: number,
): { active: true; windowId: number } | { active: true; lastFocusedWindow: true } {
  if (windowId !== undefined) return { active: true, windowId };
  return { active: true, lastFocusedWindow: true };
}

export function sessionUpdateApplies(
  messageWindowId: number | undefined,
  viewerWindowId: number | undefined,
  isolateWindow: boolean,
): boolean {
  if (!isolateWindow || messageWindowId === undefined) return true;
  return viewerWindowId === messageWindowId;
}

export function isWindowActiveTab(tabId: number, activeTabId: number | undefined): boolean {
  return activeTabId === tabId;
}

export class TabDebouncer {
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  schedule(tabId: number, delayMs: number, run: (tabId: number) => void): void {
    const previous = this.timers.get(tabId);
    if (previous !== undefined) clearTimeout(previous);
    this.timers.set(
      tabId,
      setTimeout(() => {
        this.timers.delete(tabId);
        run(tabId);
      }, delayMs),
    );
  }

  cancel(tabId: number): void {
    const previous = this.timers.get(tabId);
    if (previous === undefined) return;
    clearTimeout(previous);
    this.timers.delete(tabId);
  }
}
