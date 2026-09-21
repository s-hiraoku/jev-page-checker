# Side panel report

The side panel is the inspection view. After setup, it shows site and body lanes plus a per-question table for the current replayed page. It does not emit a single trust score.

## Sub-features

- `side-pass` shows both lanes as 通過 for the sourced-news replay.
- `side-fail` shows both lanes as 要警戒 for the sales-page replay.
- `side-questions` lists the nine question labels with a verdict chip each.
- `side-toolbar` keeps 今のタブを検査, 詳細, and 設定 on the ready panel.
- `side-nav` reaches the same pass and fail views from the preview scene buttons.

## How to get to it (user POV)

- Open `/?scene=pass#side` or `/?scene=fail#side`.
- From any preview page, choose `通過例` or `要警戒例`, then `側面パネル`.
- In the real extension (not this harness), open the toolbar icon while a tab is tracked. Do not use a shared Chrome profile to stand in for that path.

## Driving it with control-jev

Preconditions:

- Preview is healthy at `http://127.0.0.1:4174`.
- `control-jev doctor` reports `ok: true` for this run.

- **Pass URL.** Open the sourced-news panel. Run `control-jev browser goto --path "/?scene=pass#side"`. The header reads `Jev 信憑性チェッカー` and `定義 v3`. Lanes `サイト` and `本文` both show `通過`. The table title is `City delays river bridge opening after inspection, officials say`.
- **Pass questions.** Assert question labels. Run `control-jev browser text --contains "発行元が特定できる"` and `control-jev browser text --contains "主張の根拠"`. Both appear in the result table.
- **Fail URL.** Open the sales-page panel. Run `control-jev browser goto --path "/?scene=fail#side"`. Both lanes show `要警戒`. The title is `Doctors hate this: one pill reverses aging in 11 days`. The URL cell contains `http://deal-today.example/miracle-cure`.
- **Scene buttons.** From the fail panel, choose `通過例`. Run `control-jev browser click --name "通過例"`. The title returns to the city-bridge story and both lanes read `通過`.
- **Toolbar.** On the ready panel, the buttons `今のタブを検査`, `詳細`, and `設定` are present. Run `control-jev browser text --contains "今のタブを検査"`. Footer says `追跡 オン`.
- **Proof.** Stay on the pass panel. Run `control-jev browser goto --path "/?scene=pass#side"`, `control-jev browser screenshot --path .cursor/skills/verify-jev-page-checker/artifacts/side-panel-report/pass-side.png`, and `control-jev browser snapshot --path .cursor/skills/verify-jev-page-checker/artifacts/side-panel-report/pass-side.aria.txt`. Both artifacts show the app name, both 通過 lanes, and the bridge title.

## Gotchas

- `今のタブを検査` in preview reloads the same replayed session. It is not a live tab extract.
- Scene buttons change React state and do not write `?scene=` into the URL. After using them, assert visible title and lanes, not `browser url`.
- Hash `#side` is the default. A leftover `#options` from the previous recipe will hide the panel until you goto `#side`.
- Do not treat lane `通過` as a live-site endorsement. This scene is `fixtures/replay/page-credibility-pass.json`.
