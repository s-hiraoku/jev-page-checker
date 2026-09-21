# History

History is the list of past Audits. It is its own page, not part of Report. Preview seeds the list with the pass and fail records (and truncated / chunked). Storage is the same on-device history Settings already uses.

## Sub-features

- `history-open` opens the History page from the panel `History` button, the preview `History` button, or `#history`.
- `history-list` lists seeded titles and URLs.
- `history-open-report` opens Report for a chosen row via `openDetails`.

## How to get to it (user POV)

- Open `/?scene=pass#history`.
- From a ready side panel, choose `History`.
- From the preview nav, choose `History`.
- Choose a history row (`City delays…` or `Doctors hate this…`) to open that Report.

## Driving it with control-jev

Preconditions:

- Preview is healthy at `http://127.0.0.1:4174`.
- `control-jev doctor` reports `ok: true`.

- **URL entry.** Open History on the pass scene. Run `control-jev browser goto --path "/?scene=pass#history"`. Meta `History · v4` is visible. The heading is `History`, not `履歴`. Both seeded titles are listed.
- **Panel entry.** From the pass panel, choose `History`. Run `control-jev browser goto --path "/?scene=pass#side"` and `control-jev browser click --name "History"`. `control-jev browser url` includes `#history`.
- **Open a report.** On History, choose the fail title. Run `control-jev browser click --name "Doctors hate this: one pill reverses aging in 11 days"`. After it loads, expect the fail title as the current Report and `#details` in the URL.
- **Proof.** Capture the History view. Run `control-jev browser goto --path "/?scene=pass#history"`, `control-jev browser screenshot --path .cursor/skills/verify-jev-page-checker/artifacts/history/pass-history.png`, and `control-jev browser snapshot --path .cursor/skills/verify-jev-page-checker/artifacts/history/pass-history.aria.txt`. Both show `History` and the bridge title.

## Gotchas

- Report no longer lists history. If a recipe still looks for history links on `#details`, it is stale.
- History `<button>` names are the snapshot title. `click --name` matches that accessible name.
- Preview product chrome and the Inspector toolbar both use the chrome word `History`. `click --name "History"` is then two buttons; use `goto --path "/?scene=pass#history"` for URL entry, or the toolbar button inside `main`. Fixture buttons sit in a separate row.
- Empty History (`まだ履歴がありません`) is not reachable in preview because history is always seeded. Do not claim that empty state was verified here.
- Preview hash routing keeps the current in-memory bridge. Changing `scene` remounts it.
