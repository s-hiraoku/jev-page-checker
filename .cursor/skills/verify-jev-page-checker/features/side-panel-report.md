# Side panel report

The side panel is the inspection view. After setup, it shows site and body lanes plus a per-question table for the current replayed page. It does not emit a single trust score.

## Sub-features

- `side-pass` shows both lanes as Pass for the sourced-news replay.
- `side-fail` shows both lanes as Alert for the sales-page replay.
- `side-questions` lists the nine verdict labels in site then body groups, with a verdict chip each. Cite choices are not their own rows. Each pass body row includes the page sentence chosen for that question. `主張の根拠` includes `12 September`. `事実と意見の切り分け` includes `does not add costs`. `出典のない具体値` includes `photograph of the south pier`. `本文の内部矛盾` includes `hairline cracks`. `断定と根拠の釣り合い` includes `does not add costs`.
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

- **Pass URL.** Open the sourced-news panel. Run `control-jev browser goto --path "/?scene=pass#side"`. The header reads `Audit` (with mark `Jev`) and `v7`. Lanes `サイト` and `本文` both show `Pass`. The table title is `City delays river bridge opening after inspection, officials say`. Group heads `サイト` and `本文` split the question lists. Each question row includes a Japanese rubric basis such as `責任者として分かる`. The publisher row cites `Mina Ito · Example News`. The `主張の根拠` row also shows the page sentence `12 September`. Fact rows are on this panel too: `語数` `210 語`, `公開日` `2026-09-18`, `ページの形` `記事`. The `処理` row is absent. Purpose and disclosure value cells are the confidence number. Their reason lines are the selected criterion sentences, `出来事や事実を、報道または事典のように報告・説明する。` and `販売や勧誘はない。`
- **Pass questions.** Assert question labels. Run `control-jev browser text --contains "発行元が特定できる"` and `control-jev browser text --contains "なりすましではない"` and `control-jev browser text --contains "主張の根拠"` and `control-jev browser text --contains "Mina Ito · Example News"` and `control-jev browser text --contains "責任者として分かる"` and `control-jev browser text --contains "12 September"` and `control-jev browser text --contains "does not add costs"` and `control-jev browser text --contains "photograph of the south pier"` and `control-jev browser text --contains "hairline cracks"` and `control-jev browser text --contains "販売や勧誘はない"`. All appear in the grouped result tables. Do not assert `identifiable as responsible` on this default screen. `主張の根拠を支える文` is a checklist label, not a report row.
- **Fail URL.** Open the sales-page panel. Run `control-jev browser goto --path "/?scene=fail#side"`. Both lanes show `Alert`. The title is `Doctors hate this: one pill reverses aging in 11 days`. The URL cell contains `http://deal-today.example/miracle-cure`. The `主張の根拠` row includes `11 days`. `事実と意見の切り分け` includes `hiding it`. `出典のない具体値` includes `94 percent`. `本文の内部矛盾` includes `three days`. `断定と根拠の釣り合い` includes `six-month supply`. The disclosure reason is `商品、寄付、政治的な結果を推し進めつつ、誰が得をするかを隠している。`
- **Scene buttons.** From the fail panel, choose `Pass`. Run `control-jev browser click --name "Pass"`. The title returns to the city-bridge story and both lanes read `Pass`.
- **Toolbar.** On the ready panel, the buttons `Audit`, `Report`, `History`, and `Settings` are present. Run `control-jev browser text --contains "Audit"`. There is no lede about splitting lanes and no footer about following the tab.
- **Proof.** Stay on the pass panel. Run `control-jev browser goto --path "/?scene=pass#side"`, `control-jev browser screenshot --path .cursor/skills/verify-jev-page-checker/artifacts/side-panel-report/pass-side.png`, and `control-jev browser snapshot --path .cursor/skills/verify-jev-page-checker/artifacts/side-panel-report/pass-side.aria.txt`. Both artifacts show the app name, both Pass lanes, and the bridge title.

## Gotchas

- `Audit` in preview reloads the same replayed session. It is not a live tab extract.
- Scene buttons change React state and do not write `?scene=` into the URL. After using them, assert visible title and lanes, not `browser url`.
- Hash `#side` is the default. A leftover `#options` from the previous recipe will hide the panel until you goto `#side`.
- Do not treat lane `Pass` as a live-site endorsement. This scene is `fixtures/replay/page-credibility-pass.json`.
- Default preview language is Japanese. English basis text such as `identifiable as responsible` appears only after `言語` is English. A later `goto` that changes `scene` remounts the page and returns the language to Japanese.
