# Jev Audit

表示中のタブを Inspector が追い、TypeSafe の Jev で発行元と本文を分けて Audit する Chrome 拡張です。React と Manifest V3 で動きます。結果は根拠です。ページは遮断しません。公開もしません。送る先は、Audit のための Jev だけです。

このリポジトリだけで完結します。jev-checkkit とは別です。

## 動かし方

Node 26 以上が必要です。

```bash
npm install
npm test
npm run build
```

Chrome で `chrome://extensions` を開き、デベロッパーモードをオンにして `.output/chrome-mv3` を読み込みます。ツールバーのアイコンで Inspector が開きます。

1. Settings でチェックリストを読み、リスト全体を承認します。テーマと言語の「システム」は、端末の設定に合わせます。
2. TypeSafe の API キーを保存します。キーは拡張のストレージにだけ置き、Jev への問い合わせ以外には使いません。
3. 「タブに追従する」をオンにしておくと、タブの切り替えと読み込み完了のたびにやり直します。
4. Inspector はサイトと本文を別レーンで出します。Report では質問ごと、抽出した事実、Jev に送った文を見ます。Report から、その結果を端末内のファイルに残せます。過去の Audit は History で、時刻つきで並び、1 件ずつ消せます。ツールバーのアイコンも同じ分け方で、上段がサイト、下段が本文です。判定が変わると色とバッジが変わります。

画面だけ見るときは `npm run preview` です。ストア提出用の zip は `npm run zip` で `.output/` に出ます。zip のルートは `manifest.json` です。親フォルダは挟みません。`v*` タグを push すると、CI が同じ zip を GitHub Release に付けます。main と pull request では、テスト、型検査、ビルドのあと、同じ zip を Actions の成果物にも残します。掲載文は [`store/listing.md`](store/listing.md)、プライバシーポリシーは [`docs/privacy.html`](docs/privacy.html) です。Chrome ウェブストアには、その zip をそのまま上げてください。展開してフォルダごと固め直すと、ストアはマニフェストが無いと見なします。

## English

Jev Audit is a Chrome extension. Inspector follows the tab you are reading. TypeSafe Jev checks the publisher and, when the page is one piece of writing, the body. The result is evidence. The extension does not block the page, publish it, or send it anywhere except to Jev for that check.

The repo is self-contained. It is not jev-checkkit.

You need Node 26 or newer. `npm install`, `npm test`, and `npm run build` produce `.output/chrome-mv3`. Load that folder from `chrome://extensions` with developer mode on. The toolbar icon opens Inspector.

In Settings, read the checklist and accept the whole list. System theme and system language follow the device. Save a TypeSafe API key. The key stays in extension storage and is used only to call Jev. Follow the tab reruns the check when you switch tabs or a page finishes loading.

Inspector shows a site lane and a body lane. Report shows each question, facts already extracted from the page, and the text sent to Jev. You can save that report as a file on the device. History lists past Audits with the time of each check, and you can delete one record. The toolbar icon uses the same split. The top half is the site lane. The bottom half is the body lane.

`npm run preview` shows the screens without a key. `npm run zip` writes the store zip under `.output/`. `manifest.json` is at the zip root. Pushing a `v*` tag makes CI attach that zip to a GitHub Release.

## 質問

定義は `fixtures/page-credibility.checker.json` です。Jev には意味だけを聞きます。サイトの質問は 1 回にまとめます。主本文が入力枠に収まるときは 1 回で送ります。入力枠は、state と最長の質問で 32,000 トークン、1 回のリクエストで 64,000 トークンです。超えたら重ねて分割し、本文の 5 問を聞き、厳しめにまとめます。特定のサイト向けに合格線は動かしません。詳細は [`docs/judgement.md`](docs/judgement.md) です。

| id | レーン | 型 | 聞くこと |
| --- | --- | --- | --- |
| `identifiable_publisher` | サイト | noul | このページから発行元を名指しできるか。見出しの中のブランド風の語だけでは足りない。著者、署名、発行者の表示は、主本文の外にあっても数える。 |
| `honest_identity` | サイト | noul | 表示がホストと一致するか。なりすましは Alert である。批評であること自体はなりすましではない。 |
| `site_purpose` | サイト | choice | 目的のラベルである。報道、意見、一覧は Pass。販売は、報道に見せたアフィリエイトを含めて Review。風刺も Review。判別できないときは Alert。 |
| `disclosed_incentives` | サイト | choice | 勧誘がない、または誰が得をするかが書いてあるなら Pass。隠しているなら Alert。 |
| `evidence_for_claims` | 本文 | score | 確定として出した主張が、このページ上の根拠で支えられているか。仮説や未検証と書いた提案は、出典のない報道と同じ失敗にしない。記事でなければ N/A。 |
| `separates_fact_and_opinion` | 本文 | noul | 事実と意見を読み分けられるか。エッセイであること自体は失敗ではない。 |
| `unsourced_specifics` | 本文 | choice | 出典のない具体値があるか。宣伝の丸い数字も含む。未検証と書いた仮説の数値は `many` にしない。`none` は Pass、`some` は Review、`many` は Alert。 |
| `self_consistent` | 本文 | noul | 同じ事実が食い違っていないか。同じ主張の繰り返しは矛盾ではない。 |
| `certainty_matches_evidence` | 本文 | noul | 断定の強さが根拠に見合っているか。仮説や未検証と書いた点は、すでに不確かさとして書いてある。健康、金、身元、法には、より強い根拠が要る。 |

サイトのレーンは、誰が責任者か、なりすましか、何のためのページか、隠し勧誘か、を見ます。本文のレーンは、根拠、事実と意見、出典、矛盾、断定を見ます。意見であること自体は失敗ではありません。本文の各問では、ページから切った文のうち一本を Jev に選ばせ、その文を出します。Jev は文を書きません。none、または確信度 0.6 未満のときは出しません。この選択は合否を動かしません。

リンクが多く、リンクあたりの本文が短いページは一覧です。一覧では本文の 5 問は走りません。パスが `/` だから一覧、有名なサイトだから通過、という例外はありません。

noul の Pass は 0.8 以上です。choice と score の確信度の床は 0.6 です。迷ったら Review です。判定は Pass、Review、Alert、N/A、Error の 5 つです。一つの信頼スコアにはしません。

HTTPS、著者、日付、語数、リンク密度、外部ホスト、主本文が入力枠で切れたかは、コードが見ます。収まる主本文は 1 回で送ります。超えたら重ねて分割します。切れ残りがあるとき、本文の 5 問は Pass にしません。文字数の独自上限や、URL ごとの例外では直しません。定義を変えたら、Settings でリスト全体を承認し直します。

### Questions

The definition is `fixtures/page-credibility.checker.json`. Jev is asked for meaning only. The four site questions go in one request. A main body that fits the input window goes in one request. The window is 32,000 tokens for state plus the longest question, and 64,000 tokens per request. A longer body is split with overlap, the five body questions are asked, and the answers are combined strictly. The pass line is not moved for one site. See [`docs/judgement.md`](docs/judgement.md).

| id | lane | type | question |
| --- | --- | --- | --- |
| `identifiable_publisher` | site | noul | Can a publisher be named from this page? A brand-like word in the headline is not enough. An author, byline, or publisher line counts even when it sits outside the main text. |
| `honest_identity` | site | noul | Does the displayed identity match the host? Impersonation is Alert. Being a critique is not impersonation. |
| `site_purpose` | site | choice | What the page is for. News, opinion, and a listing are Pass. A sale, including affiliate copy dressed as news, is Review. Satire is Review. If the purpose cannot be told, the verdict is Alert. |
| `disclosed_incentives` | site | choice | No pitch, or a named beneficiary, is Pass. Hiding who benefits is Alert. |
| `evidence_for_claims` | body | score | Are claims stated as fact supported by evidence on this page? A proposal marked as a hypothesis or as unverified is not the same failure as unsourced news. If the page is not an article, the verdict is N/A. |
| `separates_fact_and_opinion` | body | noul | Can fact and opinion be told apart? An essay is not a failure by itself. |
| `unsourced_specifics` | body | choice | Are there specific figures with no source, including round promotional numbers? A number marked as an unverified hypothesis is not `many`. `none` is Pass, `some` is Review, `many` is Alert. |
| `self_consistent` | body | noul | Does the same fact disagree with itself? Repeating one claim is not a contradiction. |
| `certainty_matches_evidence` | body | noul | Does the strength of the wording match the evidence? A point marked as a hypothesis or as unverified already states its uncertainty. Health, money, identity, and law need stronger evidence. |

The site lane asks who is responsible, whether the page impersonates someone, what the page is for, and whether a pitch hides who benefits. The body lane asks about evidence, fact and opinion, sources, contradiction, and certainty. Opinion is not a failure by itself. For each body question, Jev selects one sentence cut from the page, and the report shows that sentence. Jev does not write it. none, or confidence below 0.6, shows no sentence. The selection does not change the verdict.

A page with many links and little text per link is a listing. The five body questions do not run on a listing. There is no exception because the path is `/`, or because the site is famous.

Noul passes at 0.8 or above. The confidence floor for choice and score is 0.6. An uncertain result is Review. The verdicts are Pass, Review, Alert, N/A, and Error. There is no single trust score.

The code judges HTTPS, author, date, word count, link density, outbound hosts, and whether the main text was cut by the input window. A body that fits is sent once. A longer body is split with overlap. If any remainder is unread, the five body questions do not pass. The fix is not a private character cap, and not an exception for one URL. If the definition changes, accept the whole list again in Settings.

## Chrome ウェブストア

提出物は次の通りです。

| 提出物 | 場所 |
| --- | --- |
| 拡張 zip | `npm run zip` → `.output/*-chrome.zip`。ルートが `manifest.json`。タグ `v*` では Release の添付になる |
| 掲載文・権限の理由 | `store/listing.md` |
| アイコン / プロモ画像 | `store/images/` |
| スクリーンショット | `store/images/screenshot-*.png` |
| プライバシーポリシー | https://s-hiraoku.github.io/jev-page-checker/privacy.html |

ダッシュボードでの作業は、Google の開発者アカウントで [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole) に入り、Add new item から zip を上げ、`store/listing.md` を転記して Submit for Review するだけです。開発者登録の 5 ドルと Google ログインは、アカウントの持ち主だけができます。
