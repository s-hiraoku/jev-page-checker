# Settings

Settings is where a user stores the TypeSafe key, tracking toggles, and a whole-list approval. The page shows all nine checklist items. Save is in-memory in preview; the visible proof is `Saved.`

## Sub-features

- `settings-open` opens the form from the panel toolbar, the preview `Settings` button, or `#options`.
- `settings-checklist` shows `質問 9` with ids such as `identifiable_publisher`.
- `settings-approve` requires the whole-list checkbox only. There is no name field and the checklist is not editable.
- `settings-save` writes the draft and shows `Saved.`
- `settings-follow` exposes `Follow tab`.
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

- **URL entry.** Open settings on the setup scene. Run `control-jev browser goto --path "/?scene=setup#options"`. Meta `Settings · v4` and `質問 9` are visible. A checklist article contains `発行元が特定できる` and `(identifiable_publisher)`.
- **Toolbar entry.** Go to the setup panel and choose `Settings`. Run `control-jev browser goto --path "/?scene=setup#side"` and `control-jev browser click --name "Settings"`. The form appears again.
- **Approve and key.** Tick the whole list and enter a key. There is no 承認者の名前 field. Run `control-jev browser check --label "上のチェックリスト全体を承認する"` and `control-jev browser fill --label "TypeSafe API キー" --value "sk-preview"`.
- **Follow tab.** Leave tracking on. Run `control-jev browser text --contains "Follow tab"`. The checkbox is checked by default.
- **Theme.** The appearance select defaults to `システム`. Run `control-jev browser text --contains "テーマ"` and `control-jev browser select --label "テーマ" --value "light"`. Then `control-jev browser attr --selector "html" --name "data-theme"` prints `light`. Repeat with `--value "dark"` then `--value "system"` to restore the default.
- **Language.** The language select defaults to `システム`. Preview Chrome is `ja-JP`, so copy starts in Japanese. Run `control-jev browser select --label "言語" --value "en"`. The page shows `Language` and `Accept this whole checklist`. Restore with `--value "ja"` or `--value "system"`.
- **Save.** Choose `Save`. Run `control-jev browser click --name "Save"`. Status `Saved.` appears.
- **Proof.** Capture the saved form. Run `control-jev browser screenshot --path .cursor/skills/verify-jev-page-checker/artifacts/settings/saved.png` and `control-jev browser snapshot --path .cursor/skills/verify-jev-page-checker/artifacts/settings/saved.aria.txt`. Both show `Settings`, the nine-item heading, and `Saved.`

## Gotchas

- Preview save does not write `chrome.storage` and does not call Jev. Assert the status text, not disk or network.
- The approval checkbox label is the full sentence `上のチェックリスト全体を承認する。判定は根拠であり、公開・送信・遮断の許可ではない。` `check --label` may use the leading clause.
- `fill --label "TypeSafe API キー"` targets a password input. The typed value is not echoed as visible text; do not screenshot-assert the key.
- Changing `scene` remounts the bridge and drops unsaved and saved preview settings. Finish the recipe before a scene `goto`.
- Definition edits require approving the **whole** list again. Do not look for a per-question ack control.
- There is no per-install character cap. Body length follows the Jev 32k token budget for every URL.
- Theme `システム` follows the browser `prefers-color-scheme`. Forced `ライト` / `ダーク` do not depend on the OS. Changing the select updates the preview immediately; `Save` persists it in that preview instance.
- Language `システム` follows the browser language (`ja*` → Japanese, anything else → English). Forced `日本語` / `English` do not depend on the OS. Switching to `en` changes chrome copy, including the approval checkbox label.
- There is no 承認者の名前 field. Do not fill a name. The checklist is read-only; only the whole-list checkbox records approval.
