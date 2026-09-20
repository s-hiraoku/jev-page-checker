# Jev 信憑性チェッカー

表示中のタブを側面パネルが追跡し、TypeSafe の Jev でサイトの発行元と本文の信憑性を検査する Chrome 拡張です。React + Manifest V3 です。レポートは判断材料だけで、ページの遮断・公開・外部送信はしません。

jev-checkkit とは別リポジトリです。この拡張だけで完結します。

## 動かし方

Node 20 以上が必要です。

```bash
npm install
npm test
npm run build
```

Chrome で `chrome://extensions` を開き、デベロッパーモードをオンにして `.output/chrome-mv3` を読み込みます。ツールバーのアイコンで側面パネルが開きます。

1. 設定でチェックリスト全文を確認し、承認者名を入れてリスト全体を承認する。
2. TypeSafe の API キーを保存する。キーは拡張のストレージにだけ置き、Jev への送信以外には使いません。
3. 「表示中のタブを追跡して検査する」をオンのままにしておくと、タブ切替と読み込み完了のたびに再検査します。
4. 側面パネルはサイトと本文を別レーンで出し、詳細画面で質問ごとと送った本文を見ます。

画面だけ見る場合は `npm run preview` です。ストア提出用の zip は `npm run zip` で `.output/` に出ます。掲載文と審査用の記入例は [`store/listing.md`](store/listing.md)、プライバシーポリシーは [`docs/privacy.html`](docs/privacy.html) です。

## 検査項目

定義は `fixtures/page-credibility.checker.json` です。Jev には意味だけを聞き、同じページへの質問は 1 回の呼び出しにまとめます。

| id | レーン | 型 | 聞くこと |
| --- | --- | --- | --- |
| `identifiable_publisher` | サイト | noul | 発行元が特定できるか |
| `site_purpose` | サイト | choice | 報道・解説 / 意見・分析 / 販売・集客 / 風刺・娯楽 / 判別できない |
| `disclosed_incentives` | サイト | noul | 販売や働きかけがあるとき利害を出しているか |
| `evidence_for_claims` | 本文 | score | 主張が本文上の根拠で支えられているか。本文が短いと not_applicable |
| `separates_fact_and_opinion` | 本文 | noul | 事実と意見が読み分けられるか |
| `unsourced_specifics` | 本文 | choice | 出典のない具体値。`none` は pass、`some` は review、`many` は fail |
| `self_consistent` | 本文 | noul | 本文が食い違っていないか |
| `certainty_matches_evidence` | 本文 | noul | 断定の強さが根拠に見合っているか |

コード側で見るのは HTTPS、著者・日付メタ、語数、外部ホストです。判定は通過 / 要確認 / 要警戒 / 対象外 / エラーの 5 種類で、一つの信頼スコアにはしません。

## Chrome ウェブストア

提出物は次の通りです。

| 提出物 | 場所 |
| --- | --- |
| 拡張 zip | `npm run zip` → `.output/*.zip` |
| 掲載文・権限の理由 | `store/listing.md` |
| アイコン / プロモ画像 | `store/images/` |
| スクリーンショット | `store/images/screenshot-*.png` |
| プライバシーポリシー | https://s-hiraoku.github.io/jev-page-checker/privacy.html |

ダッシュボードでの作業は、Google の開発者アカウントで [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole) に入り、Add new item から zip を上げ、`store/listing.md` を転記して Submit for Review するだけです。開発者登録の 5 ドルと Google ログインは、アカウントの持ち主だけができます。
