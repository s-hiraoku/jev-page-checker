# Details report

Details is the full saved report: both lanes, grouped site and body questions with chips, fact rows, the processing row, and the text sent to Jev. History is a separate page.

## Sub-features

- `details-open` opens the wide report from the panel `Report` button, the preview `Report` button, or `#details`.
- `details-full` shows the `処理` row. The compact panel shows the same fact rows and hides `処理`.
- `details-identity` shows `タイトル` and URL larger than the fact rows.
- `details-groups` splits the question table into `サイト` then `本文`, chips kept.
- `details-body` shows `送った文` with the snapshot text.

## How to get to it (user POV)

- Open `/?scene=pass#details`.
- From a ready side panel, choose `Report`.
- From the preview nav, choose `Report`.

## Driving it with control-jev

Preconditions:

- Preview is healthy at `http://127.0.0.1:4174`.
- `control-jev doctor` reports `ok: true`.

- **URL entry.** Open the pass details page. Run `control-jev browser goto --path "/?scene=pass#details"`. Meta `Report · v8` is visible. Lanes are both `Pass`. The title row is labeled `タイトル`, not `標題`. The `語数` row is `210 語`. The `HTTPS` row is `あり`. `公開日` is `2026-09-18`. `ページの形` is `記事`. `外部ホスト` includes `transport.example.gov`. The button `この端末にファイルで残す` is present. Group heads `サイト` and `本文` appear above the question tables. Question rows include the same compact table as Inspector: `寸評` and `本文`. The publisher `本文` is `Mina Ito`. The `主張の根拠` row includes `12 September`. `送った文` includes `The city transportation bureau said Thursday`. There is no History list on this page. The `処理` row is visible on this full report.
- **Panel entry.** From the pass panel, choose `Report`. Run `control-jev browser goto --path "/?scene=pass#side"` and `control-jev browser click --name "Report"`. The same sent-body section appears. `control-jev browser url` includes `#details`.
- **Proof.** Capture the pass details view. Run `control-jev browser goto --path "/?scene=pass#details"`, `control-jev browser screenshot --path .cursor/skills/verify-jev-page-checker/artifacts/details-report/pass-details.png`, and `control-jev browser snapshot --path .cursor/skills/verify-jev-page-checker/artifacts/details-report/pass-details.aria.txt`. Both show `送った文`, `タイトル`, and the bridge title.

## Gotchas

- The compact side panel shows the fact rows (`語数`, `HTTPS`, `著者`, `公開日`, `ページの形`, `外部ホスト`) and hides `処理`. `処理` is a details-only proof. There is no packed `抽出` row.
- History lives on `#history`. Do not look for past titles on Report.
- Empty details (`まだ結果がありません`) is not reachable in preview because history is always seeded. Do not claim that empty state was verified here.
