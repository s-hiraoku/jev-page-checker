# Jev Audit verification map

This directory is the maintained source for verifying the user-facing preview of Jev Audit. Read this index before driving, then use the matching feature file as the recipe.

The live product is a Chrome side panel. Scripted verification drives `npm run preview` (`control-jev`), which is the same React pages with replayed reports.

Copy here must match `src/lib/labels.ts` (`APP_NAME` `Audit`, verdicts `Pass` / `Alert` / `Review` / `N/A`).

## Baseline preconditions

- Launch with `control-jev launch --port 4174` so this run owns `http://127.0.0.1:4174`.
- Set `JEV_VERIFY_RUN_ID` if another verification run might be on the same machine.
- Run `control-jev doctor` and require `ok: true`, origin `http://127.0.0.1:4174`, title `Jev Audit preview`.
- Never drive a preview or Chrome extension this run did not start. Port 4173 is often a leftover `npm run preview`; leave it alone.
- Start every recipe from a fresh `goto` of the path in that recipe. Preview settings persist only inside the daemon's page.

## Driving conventions

- Run every UI action through `control-jev browser`.
- Prefer `goto --path` over clicking preview-only scene buttons when opening a feature. Use the scene buttons when the map lists them as an entry point.
- Prefer accessible names and label text over CSS or coordinates.
- Treat button names, labels, and fixture titles as literal.
- After a mutation (`Save`, scene change), read the next screen. Do not trust the click alone.
- Restore nothing on disk; preview state is memory. Cleanup the instance, keep artifacts.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot that shows `Audit`.
- Record the feature id and entry point on the artifact filenames.
- Report an unreachable entry point with the command and the unmet precondition. Do not mark it verified via a different path.
- Replay scenes are not live Jev results. Say which `scene` you drove.

## Feature entry contract

Each feature file starts with an H1 and one paragraph. It then uses exactly four H2 sections: `Sub-features`, `How to get to it (user POV)`, `Driving it with control-jev`, `Gotchas`.

## Features

- [Side panel report](./side-panel-report.md) covers pass and fail lanes, question rows, and the inspect toolbar.
- [Setup gate](./setup-gate.md) covers the approval block and the jump to settings.
- [Settings](./settings.md) covers the checklist, API key, follow-tab toggle, approval, and save.
- [Details report](./details-report.md) covers the full report, sent body, and history.
- [Store layout](./store-layout.md) covers the `store=1` article-plus-panel screenshot layout.
