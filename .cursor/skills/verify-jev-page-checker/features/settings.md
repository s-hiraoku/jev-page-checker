# Settings

Settings is where a user stores the TypeSafe key, tracking toggles, and a whole-list approval. The page shows all fourteen checklist items in readable sentences: nine verdict questions and five sentence-choice companions. Save is in-memory in preview; the visible proof is `保存しました。`

## Sub-features

- `settings-open` opens the form from the panel toolbar, the preview `Settings` button, or `#options`.
- `settings-checklist` shows `質問 14` with ids such as `identifiable_publisher` and `evidence_for_claims_cite`.
- `settings-approve` requires the whole-list checkbox only. There is no name field and the checklist is not editable.
- `settings-save` writes the draft and shows `保存しました。`
- `settings-follow` exposes `タブに追従する`.
- `settings-theme` exposes `テーマ` with `システム` / `ライト` / `ダーク`. Default is `システム`.
- `settings-locale` exposes `言語` with `システム` / `日本語` / `English`. Default is `システム`.

## How to get to it (user POV)

- Open `/?scene=pass#options` or `/?scene=setup#options`.
- From the side panel, choose `Settings`.
- From the preview nav, choose `Settings`.
- In the real extension, open the options page from the gear in Chrome. Do not use a shared profile as a stand-in.

## Driving it with control-jev

Preconditions:

- Preview is healthy at `http://127.0.0.1:4174`.
- `control-jev doctor` reports `ok: true`.
- Start from `/?scene=setup#options` so approval starts empty.

- **URL entry.** Open settings on the setup scene. Run `control-jev browser goto --path "/?scene=setup#options"`. Meta `Settings · v7` and `質問 14` are visible. A checklist article contains `発行元が特定できる` and `identifiable_publisher`. A cite article contains `主張の根拠を支える文`, `evidence_for_claims_cite`, and `選択肢は、このページから切った文です。Review と Alert の行には、その判定の原因になった文を出します。確信度が低くても、none でも隠しません。Pass の行と同じ文にはしません。この選択は判定のチップを動かしません。`
- **Toolbar entry.** Go to the setup panel and choose `Settings`. Run `control-jev browser goto --path "/?scene=setup#side"` and `control-jev browser click --name "Settings"`. The form appears again.
- **Approve and key.** Tick the whole list and enter a key. There is no 承認者の名前 field. Run `control-jev browser check --label "このチェックリスト全体を承認する"` and `control-jev browser fill --label "TypeSafe API キー" --value "sk-preview"`.
- **タブに追従する.** Leave tracking on. Run `control-jev browser text --contains "タブに追従する"`. The checkbox is checked by default. English locale uses `Follow the tab`.
- **Theme.** The appearance select defaults to `システム`. Run `control-jev browser text --contains "テーマ"` and `control-jev browser select --label "テーマ" --value "light"`. Then `control-jev browser attr --selector "html" --name "data-theme"` prints `light`. Repeat with `--value "dark"` then `--value "system"` to restore the default.
- **Language.** The language select defaults to `システム`. Preview Chrome is `ja-JP`, so copy starts in Japanese. Run `control-jev browser select --label "言語" --value "en"`. The page shows `Language`, `Question text`, `The definition sent to Jev is English.`, and `Accept this whole checklist.` Restore with `--value "ja"` or `--value "system"`.
- **Save.** Choose `保存`. Run `control-jev browser click --name "保存"`. Status `保存しました。` appears.
- **Proof.** Capture the saved form. Run `control-jev browser screenshot --path .cursor/skills/verify-jev-page-checker/artifacts/settings/saved.png` and `control-jev browser snapshot --path .cursor/skills/verify-jev-page-checker/artifacts/settings/saved.aria.txt`. Both show `Settings`, the fourteen-question heading, and `保存しました。`

## Gotchas

- Preview save does not write `chrome.storage` and does not call Jev. Assert the status text, not disk or network.
- The approval checkbox label is `このチェックリスト全体を承認する。` English locale uses `Accept this whole checklist.`
- `fill --label "TypeSafe API キー"` targets a password input. The typed value is not echoed as visible text; do not screenshot-assert the key.
- Changing `scene` remounts the bridge and drops unsaved and saved preview settings. Finish the recipe before a scene `goto`.
- Definition edits require approving the **whole** list again. Do not look for a per-question ack control.
- There is no per-install character cap. Body length follows the Jev 32k token budget for every URL.
- Theme `システム` follows the browser `prefers-color-scheme`. Forced `ライト` / `ダーク` do not depend on the OS. Changing the select updates the preview immediately; `保存` persists it in that preview instance.
- Language `システム` follows the browser language (`ja*` → Japanese, anything else → English). Forced `日本語` / `English` do not depend on the OS. Switching to `en` changes chrome copy, including the approval checkbox label.
- There is no 承認者の名前 field. Do not fill a name. The checklist is read-only; only the whole-list checkbox records approval.
