import type { Verdict } from "./checkkit.js";
import { PAGE_QUESTION_IDS, SITE_QUESTION_IDS, worstVerdict } from "./groups.js";
import { VERDICT_LABELS } from "./labels.js";
import type { SessionView } from "./session.js";

export type LaneTone = Verdict | "idle" | "checking" | "setup" | "unsupported";

export interface ActionIconModel {
  site: LaneTone;
  page: LaneTone;
  title: string;
  badge: string;
  badgeColor: string;
}

const RGB: Record<LaneTone, [number, number, number]> = {
  pass: [44, 106, 85],
  fail: [142, 47, 44],
  review: [181, 106, 18],
  error: [92, 74, 122],
  not_applicable: [90, 106, 120],
  idle: [197, 208, 218],
  checking: [52, 85, 120],
  setup: [181, 106, 18],
  unsupported: [197, 208, 218],
};

const PAPER: [number, number, number] = [231, 237, 242];

export function actionIconModel(view: SessionView): ActionIconModel {
  switch (view.status) {
    case "needs-setup":
      return {
        site: "setup",
        page: "setup",
        title: view.reason === "approval" ? "チェックリストの承認が必要です" : "API キーが必要です",
        badge: "!",
        badgeColor: "#b56a12",
      };
    case "idle":
      return {
        site: "idle",
        page: "idle",
        title: view.followTab ? "タブを開くと検査します" : "まだ検査していません",
        badge: "",
        badgeColor: "#5a6a78",
      };
    case "checking":
      return {
        site: "checking",
        page: "checking",
        title: "検査中…",
        badge: "…",
        badgeColor: "#345578",
      };
    case "unsupported":
      return {
        site: "unsupported",
        page: "unsupported",
        title: "http(s) のページだけを検査します",
        badge: "",
        badgeColor: "#5a6a78",
      };
    case "error":
      return {
        site: "error",
        page: "error",
        title: view.message,
        badge: "?",
        badgeColor: "#5c4a7a",
      };
    case "ready": {
      const site = worstVerdict(view.record.report.items, SITE_QUESTION_IDS);
      const page = worstVerdict(view.record.report.items, PAGE_QUESTION_IDS);
      return {
        site,
        page,
        title: `サイト: ${VERDICT_LABELS[site]} / 本文: ${VERDICT_LABELS[page]}`,
        badge: badgeFor(site, page),
        badgeColor: badgeColorFor(site, page),
      };
    }
  }
}

function worse(left: Verdict, right: Verdict): Verdict {
  return worstVerdict(
    [
      { id: "a", verdict: left },
      { id: "b", verdict: right },
    ],
    ["a", "b"],
  );
}

function badgeFor(site: Verdict, page: Verdict): string {
  switch (worse(site, page)) {
    case "fail":
      return "!";
    case "error":
      return "?";
    case "review":
      return "·";
    default:
      return "";
  }
}

function badgeColorFor(site: Verdict, page: Verdict): string {
  const tone = worse(site, page);
  const [r, g, b] = RGB[tone];
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function paintStamp(size: number, site: LaneTone, page: LaneTone): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const inset = Math.max(1, Math.round(size * 0.12));
  const gap = Math.max(1, Math.round(size * 0.08));
  const mid = Math.floor(size / 2);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const [r, g, b] =
        x < inset || x >= size - inset || y < inset || y >= size - inset || (y >= mid - Math.floor(gap / 2) && y < mid + Math.ceil(gap / 2))
          ? PAPER
          : y < mid
            ? RGB[site]
            : RGB[page];
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

export async function applyActionIcon(tabId: number, view: SessionView): Promise<void> {
  const model = actionIconModel(view);
  const imageData: Record<number, ImageData> = {};
  for (const size of [16, 32]) {
    const image = new ImageData(size, size);
    image.data.set(paintStamp(size, model.site, model.page));
    imageData[size] = image;
  }
  await chrome.action.setIcon({ tabId, imageData });
  await chrome.action.setTitle({ tabId, title: model.title });
  await chrome.action.setBadgeText({ tabId, text: model.badge });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: model.badgeColor });
}
