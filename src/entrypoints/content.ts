import { unknownErrorMessage } from "../lib/errors.js";
import { extractSnapshot } from "../lib/extract.js";
import { snapshotFingerprint } from "../lib/page-state.js";
import { isExtractMessage } from "../lib/messages.js";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main() {
    let lastFingerprint = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastMinWords = 40;

    const snapshotNow = (minWords: number) => extractSnapshot(document, location, minWords);

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!isExtractMessage(message)) return;
      try {
        lastMinWords = message.minWords;
        const snapshot = snapshotNow(lastMinWords);
        lastFingerprint = snapshotFingerprint(snapshot);
        sendResponse(snapshot);
      } catch (error) {
        sendResponse({ error: unknownErrorMessage(error) });
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
