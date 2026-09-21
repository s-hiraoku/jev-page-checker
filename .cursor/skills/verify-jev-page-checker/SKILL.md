---
name: verify-jev-page-checker
description: Drive the Jev Audit preview UI (side panel, settings, details) the way a user would. Use when proving panel, setup-gate, settings, or details behavior after UI or judgement-display changes.
---

# Verify Jev Audit

This skill drives the **preview surface**, not a loaded Chrome extension. Users normally load `.output/chrome-mv3` in Chrome and open the side panel from the toolbar. Agents do not load that into a shared Chrome profile. The repo's own screen-only path is `npm run preview`, which mounts the real `SidePanelApp`, `OptionsApp`, and `DetailsApp` against a replay bridge.

Read `features/README.md` and the matching feature file before driving. A proof that hits one convenient URL is incomplete when the map lists other entry points.

Copy in this skill must match `src/lib/copy.ts` / `src/lib/labels.ts` and the live preview chrome. The preview daemon uses `ja-JP`, so default `言語` `システム` is Japanese. Do not restore older Japanese button labels.

## What this is not

- Preview does **not** call TypeSafe / Jev. Scenes `pass` / `fail` / `setup` replay `fixtures/replay/page-credibility-*.json` through `src/preview/mock.ts`.
- Preview settings live in memory for that instance. They do not write `chrome.storage`.
- `npm test` covers extract / evaluate / replay. Run it when judgement logic changes. It does not replace driving the UI.
- Do not load the unpacked extension into a Chrome profile you did not create for this run. Do not drive a preview already listening on port 4173 unless this run started it.

## Launch

Verification uses **port 4174** so it does not collide with a developer's `npm run preview` on 4173. Isolation is by port. Preview state is in-memory; two runs may share a machine only if they use different ports and different `JEV_VERIFY_RUN_ID` values.

From the repo root:

```bash
export JEV_VERIFY_RUN_ID="${JEV_VERIFY_RUN_ID:-agent}"
.cursor/skills/verify-jev-page-checker/bin/control-jev launch --port 4174
```

Launch runs `npx wxt prepare` when `.wxt/tsconfig.json` is missing. That file is gitignored generated output; Vite cannot compile `src/preview/main.tsx` without it.

Ready when stdout contains `ready` and `origin=http://127.0.0.1:4174`. Vite has answered GET `/` with HTML whose `<title>` is `Jev Audit preview`. The helper also starts a Playwright daemon (system Chrome, headless) bound to `/tmp/jev-verify-$JEV_VERIFY_RUN_ID/browser.sock`.

If launch says the port is in use, pick another `--port`. Do not kill a foreign process by name. Do not reuse someone else's preview.

Teardown is `control-jev cleanup` (see Cleanup). That stops the processes **this run** started.

## Doctor

Run this first whenever anything looks off:

```bash
.cursor/skills/verify-jev-page-checker/bin/control-jev doctor
```

It is read-only. It must report `ok: true` plus:

- `origin` `http://127.0.0.1:4174` (or the port you passed)
- `pid` still running `vite --config vite.preview.config.ts`
- that pid (or its vite child) owns the port
- GET origin is 200 and the document title text `Jev Audit preview` is present
- browser daemon answers `ping`

If doctor fails, cleanup and launch again. Do not continue on a shared or foreign instance.

## Drive

All browser actions go through `control-jev browser`. The daemon keeps one page, so settings typed in one command are still there for the next.

```bash
.cursor/skills/verify-jev-page-checker/bin/control-jev browser goto --path "/?scene=pass#side"
.cursor/skills/verify-jev-page-checker/bin/control-jev browser click --name "Settings"
.cursor/skills/verify-jev-page-checker/bin/control-jev browser check --label "上のチェックリスト全体を承認する"
.cursor/skills/verify-jev-page-checker/bin/control-jev browser text --contains "Pass"
.cursor/skills/verify-jev-page-checker/bin/control-jev browser screenshot --path .cursor/skills/verify-jev-page-checker/artifacts/side.png
.cursor/skills/verify-jev-page-checker/bin/control-jev browser snapshot --path .cursor/skills/verify-jev-page-checker/artifacts/side.aria.txt
```

Prefer URL entry points over nav buttons when starting a recipe. Scene is a query param; page is a hash. Changing the hash keeps the current in-memory bridge; changing `scene` remounts the bridge.

| Path | User-visible page |
| --- | --- |
| `/?scene=pass#side` | Side panel, sourced news replay, both lanes Pass |
| `/?scene=fail#side` | Side panel, sales-page replay, both lanes Alert |
| `/?scene=setup#side` | Side panel blocked until checklist approval |
| `/?scene=pass#options` or `#options` after Settings | Settings form and 9-item checklist |
| `/?scene=pass#details` | Full report, 送った文, history |
| `/?scene=pass&store=1#side` | Fake article column + side panel (store screenshot layout) |

Stable handles (accessible names / labels from the real UI, not test ids):

- App chrome: heading-equivalent `Audit` (mark `Jev` + name `Audit` from `labels.ts`), meta `v3` on the panel / `Report · v3` / `Settings · v3`
- Preview nav buttons: `Pass`, `Fail`, `Truncated`, `Chunked`, `Setup`, `Inspector`, `Settings`, `Report`
- Side panel buttons: `Audit`, `Report`, `Settings` (gated panel uses the same `Settings` button)
- Side panel copy: `サイト`, `本文`, `Pass`, `Alert`, `Review`, `N/A`, `Follow tab on`
- Pass title: `City delays river bridge opening after inspection, officials say`
- Fail title: `Doctors hate this: one pill reverses aging in 11 days`
- Setup gate: `チェックリスト全体の承認が先。`
- Settings labels: `TypeSafe API キー`, `テーマ`, `言語`, `Follow tab`, `本文が変わったらやり直す`, `やり直しまでの待ち（ミリ秒）`, `本文とみなす最小語数`, `上のチェックリスト全体を承認する。判定は根拠であり、公開・送信・遮断の許可ではない。` There is no 承認者の名前 field.
- Theme options: `システム` (default), `ライト`, `ダーク`
- Locale options: `システム` (default), `日本語`, `English`. Preview daemon locale is `ja-JP`, so system copy is Japanese.
- Language options: `システム` (default), `日本語`, `English`
- Settings actions: button `Save`, status `Saved.`, heading `質問 9`
- Details: meta `Report · v3`, panel head `送った文`, history links whose names start with the snapshot title

`click --name` matches a **button** exactly. `fill --label` matches the wrapping `<label>` text exactly. `check --label` is a substring match so the long approval sentence can be shortened to `上のチェックリスト全体を承認する`.

## Evidence

Put proof under `.cursor/skills/verify-jev-page-checker/artifacts/<feature-id>/`. Cleanup must not delete this directory.

Standards:

- Drive the preview the way a user does: nav buttons, labeled fields, report tables. Do not call `checkSnapshot`, `saveSettings`, or `replayGateway` from a scratch script and call that a UI proof.
- Capture the **action and the resulting state**. A final screenshot is not enough. Pair it with an ARIA snapshot and a `text --contains` assertion from before/after.
- Preview has no disk or network side effect for settings or checks. The observable result is the next screen: `Saved.`, a hash of `#options` / `#details`, lane labels, question rows. Do not claim chrome.storage or Jev were touched.
- When proving a replay scene, assert the fixture title **and** the lane verdicts. Do not treat a green chip as a live-site pass.
- Mocks are allowed only at the existing boundary: `createPreviewBridge` / `replayGateway`. Do not add a new fake inside the React trees to make a proof pass.
- Judgement thresholds stay as in `docs/judgement.md`. Do not retune a scene so one URL looks better.

Name each artifact with the feature id and entry point, for example `artifacts/side-panel-report/pass-side.png`.

## Cleanup

```bash
.cursor/skills/verify-jev-page-checker/bin/control-jev cleanup
```

Kills only the vite pid and browser-daemon pid recorded in `/tmp/jev-verify-$JEV_VERIFY_RUN_ID/state.json`, then deletes that state directory (logs and socket included). It does **not** delete `.cursor/skills/verify-jev-page-checker/artifacts/`. Never `pkill -f vite` or Chrome by name.

After cleanup, confirm the proof files are still on disk.

## Helpers

`bin/control-jev` is executable. First run installs `playwright-core` in this skill directory (not in the extension `package.json`). Chrome is the machine's `google-chrome` via Playwright `channel: "chrome"`.

```bash
.cursor/skills/verify-jev-page-checker/bin/control-jev launch --port 4174
.cursor/skills/verify-jev-page-checker/bin/control-jev doctor
.cursor/skills/verify-jev-page-checker/bin/control-jev browser goto --path "/?scene=pass#side"
.cursor/skills/verify-jev-page-checker/bin/control-jev cleanup
```

Environment: `JEV_VERIFY_RUN_ID` (default `agent`), `JEV_VERIFY_PORT` (default `4174`), `JEV_VERIFY_REPO` (set by the wrapper to the git root), `JEV_VERIFY_STATE_DIR` (default `/tmp/jev-verify-$JEV_VERIFY_RUN_ID`).
