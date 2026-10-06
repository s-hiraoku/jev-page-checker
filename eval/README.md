# Audit の評価環境

Audit の判定が人の判定とどれだけ合うかを測ります。エンジン（Jev / Claude）、モデル、プロンプト、質問の文面を変えたときに、良くなったのか、たまたまなのかを数字で見分けるためのものです。進め方は [Automating eval design and hillclimbing](https://claude.dev/blog/automating-eval-design-and-hillclimbing/) に沿っています。

## 構成

| 場所 | 中身 |
| --- | --- |
| `eval/cases/*.json` | 1 ページ 1 ファイル。抽出済みのページ（`snapshot`）と、人が付けた期待判定（`expected`）。 |
| `src/lib/eval-case.ts` | ケースの形式、train/test の振り分け、採点。 |
| `scripts/eval-run.ts` | 実行器。製品と同じ `checkSnapshot` を通し、採点して書き出す。 |
| `scripts/eval-capture.ts` | URL からケースの下書きを作る。 |
| `.claude/hillclimb/page-audit/` | 実行結果。`_state.json` は指標の定義。`<variant>/results.jsonl`、`errors.jsonl`、`traces/`、`summary.json`。 |

## 1. ケースを集める

いちばん良いのは、実際に結果がおかしかったページです。拡張の Report 画面（詳細）で「評価ケースとして保存」を押すと、拡張が実際に抽出したページがケースの下書きとして保存されます。それを `eval/cases/` に置きます。JavaScript で本文を組み立てるページも、ブラウザで見たとおりに入ります。

URL から作ることもできます。`npm run eval:capture -- <url>` です。ただしサーバーから取得した HTML だけを読むので、ブラウザで見るページより本文が薄くなることがあります。

最初は 15〜50 ページを目安にします。15 未満だと、1 ケースの揺れで点数が大きく動きます。発行元が分かりにくいページ、なりすまし、記事に見せた広告、意見記事、一覧ページ、日本語と英語を混ぜます。そのエンジンが今失敗するページだけを集めるのではなく、人が見ても判断が難しいページを集めます。

## 2. ラベルを付ける

`expected.items` に、項目 id ごとに受け入れる判定を書きます。迷う項目は複数書けます（`["review", "fail"]`）。書かなかった項目は採点しません。`expected.category` は本文の分類 id です。一つの文章ではないページは `null` にします。書かなければ採点しません。付け終えたら `labeledBy` を `"human"` にします。採点に入るのは `"human"` のケースだけです。

```json
"expected": {
  "items": { "identifiable_publisher": "pass", "disclosed_incentives": ["review", "fail"] },
  "category": "reporting"
}
```

ラベルは、エンジンの答えを見ずにページを読んで付けます。エンジンの答えを正解として写すと、その答えをまねたものが高得点になります。書き出したケースにエンジンの判定が入っていないのはそのためです。

判定の意味は [`docs/judgement.md`](../docs/judgement.md) と現在のチェッカー定義に従います。たとえば `site_purpose` は「目的が読み手に分かるか」なので、目的がはっきりした販売ページは Pass です。誰が得をするかは `disclosed_incentives` で見ます。

`eval/cases/fixture-*.json` の 5 件は、replay 用の合成ページに Claude が下書きのラベルを付けたものです（`labeledBy: "draft"`）。仕組みを確かめるための種で、実ページの代わりにはなりません。

## 3. 実行する

```bash
npm run eval -- --approve-harness                  # 初回と、採点・実行器・ケースを変えたあとに人が実行する
ANTHROPIC_API_KEY=... npm run eval -- --variant baseline --engine claude --model claude-opus-5-5
TYPESAFE_API_KEY=...  npm run eval -- --variant v1 --engine jev
npm run eval -- --summary baseline                 # 結果をもう一度表示する
```

`--reps N` は同じケースを N 回実行します（揺れを測るため）。`--split train|test` で範囲を絞ります。`--include-drafts` を付けると下書きのケースも実行します。`--concurrency` と `--timeout-s` も指定できます。途中で止まっても、終わった（ケース、回）は飛ばして再開します。API の失敗、拒否、時間切れ、指定と違うモデルが応答した回は `errors.jsonl` に入り、点数には入りません。

採点器、実行器、ケースのどれかを変えると、`--approve-harness` をもう一度実行するまで動きません。改善の途中で、採点やラベルのほうを動かして点数を上げることを防ぐためです。このフラグは人が実行します。

## 指標

| 指標 | 意味 |
| --- | --- |
| `verdict_acc` | ラベルを付けた項目のうち、判定が受け入れる値だった割合。見出しの指標。 |
| `all_correct` | ラベルを付けた項目と分類がすべて合ったケース。 |
| `false_pass` | 人が要確認か警告とした項目を、エンジンが Pass にした数。いちばん避けたい誤り。 |
| `false_alert` | 人が Pass とした項目を、エンジンが警告にした数。 |
| `error_items` | 判定が Error か、出なかった項目の数。 |
| `category_ok` | 本文の分類が合ったか。 |

まとめは train、test、全体ごとに、平均と 95% 区間で出します。区間が重なる差は、まだ差とは言えません。25 ケースを 1 回ずつ実行した場合、揺れは最大でおよそ ±20 ポイントです。小さな改善を見たいなら、ケースか回数を増やします。

Report の HTML が欲しいときは、Claude Code で `/claude-api` を一度読み込み、その中の `shared/evals/report/build-report-lite.mjs` を `.claude/hillclimb/page-audit/` に対して実行します。

## 改善を繰り返す（hill-climb）

`/claude-api hillclimb` で回せます。変えてよいのは、どの URL にも同じように効くものだけです。

- Claude の system prompt（`src/lib/claude-gateway.ts` の `CLAUDE_SYSTEM_PROMPT`）
- エンジン、モデル、effort
- チェッカー定義の質問とラベルの説明。定義を変えたら、Settings でリスト全体を承認し直します。

変えてはいけないのは、`docs/judgement.md` が禁じていることです。特定のホスト、URL、記事名をプロンプトや定義に書くこと、失敗したページの文面をプロンプトに貼ること、合格線や確信度の床を点数に合わせて動かすことはしません。読んでよいのは train の失敗だけです。test の点数が上がらない変更は戻します。各回は `v1/`、`v2/` … に出し、`change.md` に何を変えたかを書きます。

## English

This measures how often the audit's verdicts match a person's labels, so a change of engine, model, prompt, or question wording can be told apart from noise. Cases live in `eval/cases/` (one page each: an extracted `snapshot` and human `expected` verdicts). Use "Save as eval case" on the extension's report page to export a page exactly as the extension extracted it, or `npm run eval:capture -- <url>`. Label without looking at an engine's answer and set `labeledBy` to `"human"`. Then run `npm run eval -- --approve-harness` once (a person does this), followed by `npm run eval -- --variant baseline --engine claude|jev`. Results follow the `/claude-api` hillclimb layout under `.claude/hillclimb/page-audit/`. About 30% of cases are held out as test, chosen by a hash of the id. A hill-climb may change the Claude system prompt, the engine and model, or the checklist wording, but never in a way that names a host, URL, or article, and never by moving the pass lines (see `docs/judgement.md`).
