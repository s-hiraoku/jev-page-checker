import { extractSnapshot } from "../lib/extract.js";
import { snapshotFingerprint } from "../lib/page-state.js";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main() {
    let lastFingerprint = "";
    let timer: ReturnType<typeof setTimeout> | undefined;

    let lastMinWords = 40;

    const snapshotNow = (minWords: number) => extractSnapshot(document, location, minWords);

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== "EXTRACT") return;
      try {
        lastMinWords = message.minWords;
        const snapshot = snapshotNow(lastMinWords);
        lastFingerprint = snapshotFingerprint(snapshot);
        sendResponse(snapshot);
      } catch (error) {
        sendResponse({ error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    });

    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const snapshot = snapshotNow(lastMinWords);
        const fingerprint = snapshotFingerprint(snapshot);
        if (fingerprint === lastFingerprint) return;
        lastFingerprint = fingerprint;
        void chrome.runtime.sendMessage({ type: "PAGE_CHANGED", fingerprint });
      }, 1200);
    });
    observer.observe(document.documentElement, { subtree: true, characterData: true, childList: true });
  },
});
