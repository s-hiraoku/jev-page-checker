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

export const RGB: Record<LaneTone, [number, number, number]> = {
  pass: [36, 148, 92],
  fail: [196, 48, 44],
  review: [214, 132, 16],
  error: [108, 64, 160],
  not_applicable: [96, 116, 132],
  idle: [52, 92, 140],
  checking: [36, 108, 176],
  setup: [214, 132, 16],
  unsupported: [168, 178, 188],
};

const PAPER: [number, number, number] = [244, 247, 250];

export function actionIconModel(view: SessionView): ActionIconModel {
  switch (view.status) {
    case "needs-setup":
      return {
        site: "setup",
        page: "setup",
        title: view.reason === "approval" ? "チェックリストの承認が必要です" : "API キーが必要です",
        badge: "!",
        badgeColor: "#d68410",
      };
    case "idle":
      return {
        site: "idle",
        page: "idle",
        title: view.followTab ? "タブを開くと裏を取る" : "まだ裏を取っていない",
        badge: "",
        badgeColor: "#345c8c",
      };
    case "checking":
      return {
        site: "checking",
        page: "checking",
        title: "裏取り中…",
        badge: "…",
        badgeColor: "#246cb0",
      };
    case "unsupported":
      return {
        site: "unsupported",
        page: "unsupported",
        title: "http(s) のページだけ",
        badge: "",
        badgeColor: "#5a6a78",
      };
    case "error":
      return {
        site: "error",
        page: "error",
        title: view.message,
        badge: "?",
        badgeColor: "#6c40a0",
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
    case "review":
      return "?";
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
  const inset = Math.max(1, Math.round(size * 0.08));
  const gap = Math.max(1, Math.round(size * 0.06));
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

export function createIconImageData(size: number, site: LaneTone, page: LaneTone): ImageData {
  const pixels = paintStamp(size, site, page);
  if (typeof OffscreenCanvas === "function") {
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext("2d");
    if (context !== null) {
      const image = context.createImageData(size, size);
      image.data.set(pixels);
      return image;
    }
  }
  const image = new ImageData(size, size);
  image.data.set(pixels);
  return image;
}

export async function applyActionIcon(tabId: number, view: SessionView): Promise<void> {
  const model = actionIconModel(view);
  const imageData: Record<number, ImageData> = {};
  for (const size of [16, 32]) {
    imageData[size] = createIconImageData(size, model.site, model.page);
  }
  // The toolbar button is the resident icon. Set it globally so Chrome actually
  // replaces the packed default, then pin the same stamp to the tab.
  await chrome.action.setIcon({ imageData });
  await chrome.action.setTitle({ title: model.title });
  await chrome.action.setBadgeText({ text: model.badge });
  await chrome.action.setBadgeBackgroundColor({ color: model.badgeColor });
  try {
    await chrome.action.setIcon({ tabId, imageData });
    await chrome.action.setTitle({ tabId, title: model.title });
    await chrome.action.setBadgeText({ tabId, text: model.badge });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: model.badgeColor });
  } catch {
    return;
  }
}
