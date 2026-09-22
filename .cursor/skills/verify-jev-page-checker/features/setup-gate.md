# Setup gate

Until the checklist is approved (and then an API key is saved), the side panel refuses to inspect and sends the user to settings. Preview scene `setup` starts with no whole-list acknowledgement and an empty key.

## Sub-features

- `setup-approval` blocks the panel with the approval message when `ackedVersion` is missing.
- `setup-open-options` opens settings from `Settings`.
- `setup-nav` reaches the same gate from the `Setup` preview button.

## How to get to it (user POV)

- Open `/?scene=setup#side`.
- From the preview nav, choose `Setup` then `Inspector`.
- In the real extension, first launch with no stored approval. Do not use a shared profile as a stand-in.

## Driving it with control-jev

Preconditions:

- Preview is healthy at `http://127.0.0.1:4174`.
- `control-jev doctor` reports `ok: true`.

- **Gate URL.** Open the setup panel. Run `control-jev browser goto --path "/?scene=setup#side"`. The notice reads `先に、チェックリスト全体を承認してください。` There is no result table and no `サイト` / `本文` lane pair for a current report.
- **Open settings.** Choose `Settings`. Run `control-jev browser click --name "Settings"`. The hash becomes `#options`, meta `Settings · v7` is visible, and `質問 14` is visible.
- **Nav entry.** Return to the gate from the preview chrome. Run `control-jev browser click --name "Setup"` then `control-jev browser click --name "Inspector"`. The approval notice is back.
- **Proof.** Capture the blocked panel. Run `control-jev browser goto --path "/?scene=setup#side"`, `control-jev browser screenshot --path .cursor/skills/verify-jev-page-checker/artifacts/setup-gate/blocked.png`, and `control-jev browser snapshot --path .cursor/skills/verify-jev-page-checker/artifacts/setup-gate/blocked.aria.txt`. Both show the approval sentence and `Settings`, not lane verdicts.

## Gotchas

- Approval is checked before the API key. Scene `setup` therefore shows the approval sentence, not `TypeSafe の API キーがまだない。` Seeing the key message means the checklist was already approved in this page's memory.
- The gate and the toolbar share the same `Settings` button.
- Remounting via `goto --path "/?scene=setup#side"` resets the in-memory bridge. Do that before proving the gate after a settings save.
