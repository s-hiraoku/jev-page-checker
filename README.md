# Jev Audit

表示中のタブを Inspector が追い、TypeSafe の Jev で発行元と本文を分けて Audit する Chrome 拡張です。React と Manifest V3 で動きます。結果は根拠です。ページの遮断、公開、外部への送信はしません。

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

定義は `fixtures/page-credibility.checker.json` です。Jev には意味だけを聞く。サイトの質問は 1 回にまとめ、主本文が Jev の入力枠（state と最長の質問で 32k トークン、1 リクエスト 64k）に収まるときは 1 回で送り、超えたら重ねて分割して本文 5 問を聞き、厳しめに合成する。特定サイト向けに合格線を動かさないこと。詳細は [`docs/judgement.md`](docs/judgement.md) です。

| id | レーン | 型 | 聞くこと |
| --- | --- | --- | --- |
| `identifiable_publisher` | サイト | noul | このページから発行元を名指しできるか。見出しのブランド風の語だけでは足りない。著者・byline・発行者 chrome は主本文の外にあっても数える |
| `honest_identity` | サイト | noul | 表示がホストと一致するか。なりすましは Alert。批評であること自体はなりすましではない |
| `site_purpose` | サイト | choice | 目的のラベル。報道・意見・一覧は Pass。販売（報道に見せたアフィリエイト含む）・風刺は Review。判別不能は Alert |
| `disclosed_incentives` | サイト | noul | 販売や働きかけがあるとき、誰が得をするかを出しているか |
| `evidence_for_claims` | 本文 | score | 確定として出した主張がこのページ上の根拠で支えられているか。仮説・未検証と明記した提案は未裏付け報道と同じ失敗にしない。記事でないと N/A |
| `separates_fact_and_opinion` | 本文 | noul | 事実と意見が読み分けられるか。エッセイであること自体は失敗ではない |
| `unsourced_specifics` | 本文 | choice | 出典のない具体値。宣伝の丸い数字も含む。未検証と書いた仮説の数値は `many` にしない。`none` は Pass、`some` は Review、`many` は Alert |
| `self_consistent` | 本文 | noul | 同じ事実が食い違っていないか。反復は矛盾ではない |
| `certainty_matches_evidence` | 本文 | noul | 断定の強さが根拠に見合っているか。仮説・未検証と明記した点は正しい不確かさ。健康・金・法はより強い根拠が要る |

サイトのレーンは、誰が責任者か、なりすましか、何のためのページか、隠し勧誘か、です。本文のレーンは、根拠、事実と意見、出典、矛盾、断定、です。意見であること自体は危険ではありません。リンクが多く、リンクあたりの本文が短い一覧は記事ではないので、本文の 5 問は走りません。パスが `/` だから一覧、有名なサイトだから通過、という例外はありません。noul の Pass は 0.8 以上です。choice と score の確信度の床は 0.6 です。迷ったら Review です。HTTPS、著者、日付、語数、リンク密度、外部ホスト、主本文が Jev の入力枠で切れたかは、コードが見ます。収まる主本文は 1 回で送ります。超えたら重ねて分割します。切れ残りがあるとき、本文の 5 問は Pass にしません。文字数の独自上限や、URL ごとの例外では直しません。判定は Pass、Review、Alert、N/A、Error の 5 つです。一つの信頼スコアにはしません。定義を変えたら、Settings でリスト全体を承認し直します。

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
