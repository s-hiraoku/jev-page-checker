import { unknownErrorMessage } from "../lib/errors.js";
import { extractSnapshot } from "../lib/extract.js";
import { snapshotFingerprint } from "../lib/page-state.js";
import { DEFAULT_SETTINGS } from "../lib/settings.js";
import { isExtractMessage } from "../lib/messages.js";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main() {
    let lastFingerprint = "";
    let timer: ReturnType<typeof setTimeout> | undefined;

    const snapshotNow = (maxChars = DEFAULT_SETTINGS.maxChars, minWords = DEFAULT_SETTINGS.minWords) =>
      extractSnapshot(document, location, maxChars, minWords);

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!isExtractMessage(message)) return;
      try {
        const snapshot = snapshotNow(message.maxChars, message.minWords);
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
        const snapshot = snapshotNow();
        const fingerprint = snapshotFingerprint(snapshot);
        if (fingerprint === lastFingerprint) return;
        lastFingerprint = fingerprint;
        void chrome.runtime.sendMessage({ type: "PAGE_CHANGED", fingerprint });
      }, 1200);
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  },
});
