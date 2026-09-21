# Details report

Details is the full saved report: both lanes, every question with its reason, the text sent to Jev, and a history list. Preview seeds history with the pass and fail records.

## Sub-features

- `details-open` opens the wide report from the panel `Report` button, the preview `Report` button, or `#details`.
- `details-full` shows extract and timing rows that the compact panel hides.
- `details-body` shows `送った文` with the snapshot text.
- `details-history` lists both seeded titles and can switch via `?id=`.

## How to get to it (user POV)

- Open `/?scene=pass#details`.
- From a ready side panel, choose `Report`.
- From the preview nav, choose `Report`.
- Choose a history link (`City delays…` or `Doctors hate this…`) to change `?id=`.

## Driving it with control-jev

Preconditions:

- Preview is healthy at `http://127.0.0.1:4174`.
- `control-jev doctor` reports `ok: true`.

- **URL entry.** Open the pass details page. Run `control-jev browser goto --path "/?scene=pass#details"`. Meta `Report · v4` is visible. Lanes are both `Pass`. The extract row contains `210 語` and `HTTPS あり`. `送った文` includes `The city transportation bureau said Thursday`.
- **Panel entry.** From the pass panel, choose `Report`. Run `control-jev browser goto --path "/?scene=pass#side"` and `control-jev browser click --name "Report"`. The same sent-body section appears. `control-jev browser url` includes `#details`.
- **History.** On details, both history titles are listed. Run `control-jev browser text --contains "Doctors hate this: one pill reverses aging in 11 days"`. Choosing that link is a page navigation (`?id=preview-fail`); after it loads, wait for `Audit` and expect the fail title as the current report. Preview hash routing may drop `#details` on that navigation — if the side panel returns, `goto --path "/?scene=fail#details"` and say which entry you used.
- **Proof.** Capture the pass details view. Run `control-jev browser goto --path "/?scene=pass#details"`, `control-jev browser screenshot --path .cursor/skills/verify-jev-page-checker/artifacts/details-report/pass-details.png`, and `control-jev browser snapshot --path .cursor/skills/verify-jev-page-checker/artifacts/details-report/pass-details.aria.txt`. Both show `送った文` and the bridge title.

## Gotchas

- Compact side panel omits 抽出 and 処理 rows. Those strings are a details-only proof.
- History `<a href="?id=preview-fail">` is a full navigation. It can reset hash and scene. Re-`goto` the intended path after clicking it.
- Empty details (`まだ結果がありません`) is not reachable in preview because history is always seeded. Do not claim that empty state was verified here.
