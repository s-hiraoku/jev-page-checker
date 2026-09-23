# Side panel report

The side panel is the inspection view. After setup, it shows site and body lanes plus a per-question table for the current replayed page. It does not emit a single trust score.

## Sub-features

- `side-pass` shows both lanes as Pass for the sourced-news replay.
- `side-fail` shows both lanes as Alert for the sales-page replay.
- `side-questions` lists the nine verdict labels in site then body groups. Cite choices are not their own rows. Each card is four blocks: `判定`, `基準`, `寸評`, `根拠`. The remark is not the criterion paragraph. Each pass body card includes the page sentence chosen for that question. `主張の検証手掛かり` includes `12 September`. `情報源の帰属` includes `does not add costs`. `引用・数字の文脈` includes `photograph of the south pier`. `中心事実と時点` includes `hairline cracks`. `未確定情報の扱い` includes `opening date`. Those last two sentences are different.
- `side-toolbar` keeps Audit, Report, History, and Settings on the ready panel.
- `side-nav` reaches the same pass and fail views from the preview scene buttons.

## How to get to it (user POV)

- Open `/?scene=pass#side` or `/?scene=fail#side`.
- From any preview page, choose `Pass` or `Fail`, then `Inspector`.
- In the real extension (not this harness), open the toolbar icon while a tab is tracked. Do not use a shared Chrome profile to stand in for that path.

## Driving it with control-jev

Preconditions:

- Preview is healthy at `http://127.0.0.1:4174`.
- `control-jev doctor` reports `ok: true` for this run.

- **Pass URL.** Open the sourced-news panel. Run `control-jev browser goto --path "/?scene=pass#side"`. The banner reads `Jev Audit v10`. The summary line is `サイト 通過 | 本文 通過 | 報道・事実報告`. The title is `City delays river bridge opening after inspection, officials say`. Group heads `サイト` and `本文` split the cards. Each card is `判定`, `基準`, `寸評`, `根拠`. `寸評` is a short fixed sentence for that question and that verdict, such as `ページから責任者が分かる。` It is not the criterion paragraph. `根拠` is the page sentence. The publisher row cites `Mina Ito`. The identity row cites `Example News`. The `主張の検証手掛かり` row also shows the page sentence `12 September`. Fact rows are on this panel too: `語数` `210 語`, `公開日` `2026-09-18`, `ページの形` `記事`. The `処理` row is absent. Confidence stays under `詳細`. The stored v8 purpose remark is `主な目的は報道、意見、一覧のいずれか。` The disclosure remark is `勧誘はないか、受益者が明記されている。`
- **Pass questions.** Assert question labels. Run `control-jev browser text --contains "発行元が特定できる"` and `control-jev browser text --contains "なりすましではない"` and `control-jev browser text --contains "主張の検証手掛かり"` and `control-jev browser text --contains "Mina Ito"` and `control-jev browser text --contains "寸評"` and `control-jev browser text --contains "本文"` and `control-jev browser text --contains "ページから責任者が分かる。"` and `control-jev browser text --contains "12 September"` and `control-jev browser text --contains "does not add costs"` and `control-jev browser text --contains "photograph of the south pier"` and `control-jev browser text --contains "hairline cracks"` and `control-jev browser text --contains "opening date"` and `control-jev browser text --contains "勧誘がないか、受益者が書いてある。"`. All appear in the grouped result tables. The criteria block on this panel includes `責任者として分かる`. Do not assert `identifiable as responsible` on this default screen. `主張の根拠を支える文` is a checklist label, not a report row.
- **Fail URL.** Open the sales-page panel. Run `control-jev browser goto --path "/?scene=fail#side"`. Both lanes show `Alert`. The title is `Doctors hate this: one pill reverses aging in 11 days`. The URL cell contains `http://deal-today.example/miracle-cure`. The `提供内容と負担` row includes `11 days`. `制約とリスク` includes `hiding it`. `効能・優位性の根拠` includes `94 percent` and not the `11 days` sentence. `参加・契約条件` includes `three days`. The purpose row is `Pass`, and its evidence includes `six-month supply`. The disclosure row is `Alert`, its remark is `誰が得をするかを、隠している。`, and its `本文` includes `Order now`. The publisher `本文` includes `manufacturer is named`. Do not assert the criterion paragraph on this panel.
- **Scene buttons.** From the fail panel, choose `Pass`. Run `control-jev browser click --name "Pass"`. The title returns to the city-bridge story and both lanes read `Pass`.
- **Toolbar.** On the ready panel, the buttons `Audit`, `Report`, `History`, and `Settings` are present. Run `control-jev browser text --contains "Audit"`. There is no lede about splitting lanes and no footer about following the tab.
- **Proof.** Stay on the pass panel. Run `control-jev browser goto --path "/?scene=pass#side"`, `control-jev browser screenshot --path .cursor/skills/verify-jev-page-checker/artifacts/side-panel-report/pass-side.png`, and `control-jev browser snapshot --path .cursor/skills/verify-jev-page-checker/artifacts/side-panel-report/pass-side.aria.txt`. Both artifacts show the app name, both Pass lanes, and the bridge title.

## Gotchas

- `Audit` in preview reloads the same replayed session. It is not a live tab extract.
- Scene buttons change React state and do not write `?scene=` into the URL. After using them, assert visible title and lanes, not `browser url`.
- Hash `#side` is the default. A leftover `#options` from the previous recipe will hide the panel until you goto `#side`.
- Do not treat lane `Pass` as a live-site endorsement. This scene is `fixtures/replay/page-credibility-pass.json`.
- Default preview language is Japanese. English basis text such as `identifiable as responsible` appears only after `言語` is English. A later `goto` that changes `scene` remounts the page and returns the language to Japanese.
