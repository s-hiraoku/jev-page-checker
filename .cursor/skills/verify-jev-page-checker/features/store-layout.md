# Store layout

`store=1` is the screenshot layout used for the Chrome Web Store: a fake article column beside the real side panel. The panel still renders `SidePanelApp`. This path is preview-only.

## Sub-features

- `store-pass` shows the news article column plus a 通過 panel.
- `store-fail` shows the sales article column plus a 要警戒 panel.
- `store-nav-hidden` hides the preview scene/page buttons on the side layout.

## How to get to it (user POV)

- Open `/?scene=pass&store=1#side`.
- Open `/?scene=fail&store=1#side`.
- `#options` and `#details` with `store=1` still render those pages, without the article column.

## Driving it with control-jev

Preconditions:

- Preview is healthy at `http://127.0.0.1:4174`.
- `control-jev doctor` reports `ok: true`.

- **Pass layout.** Open the store news layout. Run `control-jev browser goto --path "/?scene=pass&store=1#side"`. The article column reads `報道ページの例` and `City delays river bridge opening after inspection`. The panel still shows `Jev 信憑性チェッカー` and both lanes `通過`. Preview buttons `通過例` / `側面パネル` are absent.
- **Fail layout.** Open the store sales layout. Run `control-jev browser goto --path "/?scene=fail&store=1#side"`. The article column reads `販売ページの例` and `Doctors hate this: one pill reverses aging in 11 days`. Panel lanes are `要警戒`.
- **Proof.** Capture the pass store layout. Run `control-jev browser screenshot --path .cursor/skills/verify-jev-page-checker/artifacts/store-layout/pass-store.png` and `control-jev browser snapshot --path .cursor/skills/verify-jev-page-checker/artifacts/store-layout/pass-store.aria.txt`. Both show the fake article heading and the side panel identity together.

## Gotchas

- This is a marketing layout, not a second product. If `store=1` breaks, the side panel on `#side` without `store` is still the user path.
- There is no preview nav on the side store layout. Scene changes require a new `goto`, not button clicks.
- Do not use this layout as the only proof of lane verdicts; also drive `side-panel-report` without `store=1`.
