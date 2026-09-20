# Setup gate

Until the checklist is approved (and then an API key is saved), the side panel refuses to inspect and sends the user to settings. Preview scene `setup` starts with an empty approver and empty key.

## Sub-features

- `setup-approval` blocks the panel with the approval message when `ackedVersion` is missing.
- `setup-open-options` opens settings from `設定を開く`.
- `setup-nav` reaches the same gate from the `初期設定` preview button.

## How to get to it (user POV)

- Open `/?scene=setup#side`.
- From the preview nav, choose `初期設定` then `側面パネル`.
- In the real extension, first launch with no stored approval. Do not use a shared profile as a stand-in.

## Driving it with control-jev

Preconditions:

- Preview is healthy at `http://127.0.0.1:4174`.
- `control-jev doctor` reports `ok: true`.

- **Gate URL.** Open the setup panel. Run `control-jev browser goto --path "/?scene=setup#side"`. The notice reads `設定でチェックリスト全体を承認するまで検査しません。` There is no result table and no `サイト` / `本文` lane pair for a current report.
- **Open settings.** Choose `設定を開く`. Run `control-jev browser click --name "設定を開く"`. The hash becomes `#options`, the heading is `設定`, and `検査項目 9 件` is visible.
- **Nav entry.** Return to the gate from the preview chrome. Run `control-jev browser click --name "初期設定"` then `control-jev browser click --name "側面パネル"`. The approval notice is back.
- **Proof.** Capture the blocked panel. Run `control-jev browser goto --path "/?scene=setup#side"`, `control-jev browser screenshot --path .cursor/skills/verify-jev-page-checker/artifacts/setup-gate/blocked.png`, and `control-jev browser snapshot --path .cursor/skills/verify-jev-page-checker/artifacts/setup-gate/blocked.aria.txt`. Both show the approval sentence and `設定を開く`, not lane verdicts.

## Gotchas

- Approval is checked before the API key. Scene `setup` therefore shows the approval sentence, not `TypeSafe の API キーがまだありません。` Seeing the key message means the checklist was already approved in this page's memory.
- `設定` in the toolbar also opens options. That is a different entry; if you use it, say so. The gate's own control is `設定を開く`.
- Remounting via `goto --path "/?scene=setup#side"` resets the in-memory bridge. Do that before proving the gate after a settings save.
