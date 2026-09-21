# Details report

Details is the full saved report: both lanes, every question with its reason, the text sent to Jev, and a history list. Preview seeds history with the pass and fail records.

## Sub-features

- `details-open` opens the wide report from the panel `詳細` button, the preview `詳細` button, or `#details`.
- `details-full` shows extract and timing rows that the compact panel hides.
- `details-body` shows `送った本文` with the snapshot text.
- `details-history` lists both seeded titles and can switch via `?id=`.

## How to get to it (user POV)

- Open `/?scene=pass#details`.
- From a ready side panel, choose `詳細`.
- From the preview nav, choose `詳細`.
- Choose a history link (`City delays…` or `Doctors hate this…`) to change `?id=`.

## Driving it with control-jev

Preconditions:

- Preview is healthy at `http://127.0.0.1:4174`.
- `control-jev doctor` reports `ok: true`.

- **URL entry.** Open the pass details page. Run `control-jev browser goto --path "/?scene=pass#details"`. Heading `検査の詳細` is visible. Lanes are both `通過`. The extract row contains `210 語` and `HTTPS あり`. `送った本文` includes `The city transportation bureau said Thursday`.
- **Panel entry.** From the pass panel, choose `詳細`. Run `control-jev browser goto --path "/?scene=pass#side"` and `control-jev browser click --name "詳細"`. The same heading and sent-body section appear. `control-jev browser url` includes `#details`.
- **History.** On details, both history titles are listed. Run `control-jev browser text --contains "Doctors hate this: one pill reverses aging in 11 days"`. Choosing that link is a page navigation (`?id=preview-fail`); after it loads, wait for `Jev 信憑性チェッカー` and expect the fail title as the current report. Preview hash routing may drop `#details` on that navigation — if the side panel returns, `goto --path "/?scene=fail#details"` and say which entry you used.
- **Proof.** Capture the pass details view. Run `control-jev browser goto --path "/?scene=pass#details"`, `control-jev browser screenshot --path .cursor/skills/verify-jev-page-checker/artifacts/details-report/pass-details.png`, and `control-jev browser snapshot --path .cursor/skills/verify-jev-page-checker/artifacts/details-report/pass-details.aria.txt`. Both show `検査の詳細`, `送った本文`, and the bridge title.

## Gotchas

- Compact side panel omits 抽出 and 処理 rows. Those strings are a details-only proof.
- History `<a href="?id=preview-fail">` is a full navigation. It can reset hash and scene. Re-`goto` the intended path after clicking it.
- Empty details (`まだ検査結果がありません`) is not reachable in preview because history is always seeded. Do not claim that empty state was verified here.
