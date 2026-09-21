# Jev Audit

表示中のタブを Inspector が追跡し、TypeSafe の Jev でサイトの発行元と本文を Audit する Chrome 拡張です。React + Manifest V3 です。レポートは判断材料だけで、ページの遮断・公開・外部送信はしません。

jev-checkkit とは別リポジトリです。この拡張だけで完結します。

## 動かし方

Node 26 以上が必要です。

```bash
npm install
npm test
npm run build
```

Chrome で `chrome://extensions` を開き、デベロッパーモードをオンにして `.output/chrome-mv3` を読み込みます。ツールバーのアイコンで Inspector が開きます。

1. 設定でチェックリスト全文を確認し、リスト全体を承認する。テーマと言語は未設定なら端末に合わせる。
2. TypeSafe の API キーを保存する。キーは拡張のストレージにだけ置き、Jev への送信以外には使いません。
3. Follow tab をオンのままにしておくと、タブ切替と読み込み完了のたびにやり直します。
4. Inspector はサイトと本文を別レーンで出し、Report で質問ごとと送った文を見ます。過去の Audit は History です。Chrome ツールバーの常駐アイコンも同じ分け方で、上段がサイト、下段が本文です。判定が変わると色とバッジが差し替わります。

画面だけ見る場合は `npm run preview` です。手元のストア提出用 zip は `npm run zip` で `.output/` に出ます。中身のルートに `manifest.json` があり、親フォルダは挟みません。`v*` タグを push すると CI が同じ zip を GitHub Release に付けます。main と pull request ではテスト・型検査・ビルドのあと、同じ zip を Actions の成果物にも残します。掲載文と審査用の記入例は [`store/listing.md`](store/listing.md)、プライバシーポリシーは [`docs/privacy.html`](docs/privacy.html) です。Chrome ウェブストアにはその zip をそのまま上げてください。展開してフォルダごと固め直すと、ストアはマニフェスト無しと見なします。

## 質問

定義は `fixtures/page-credibility.checker.json` です。Jev には意味だけを聞く。サイトの質問は 1 回にまとめ、主本文が Jev の入力枠（state と最長の質問で 32k トークン、1 リクエスト 64k）に収まるときは 1 回で送り、超えたら重ねて分割して本文 5 問を聞き、厳しめに合成する。特定サイト向けに合格線を動かさないこと。詳細は [`docs/judgement.md`](docs/judgement.md) です。

| id | レーン | 型 | 聞くこと |
| --- | --- | --- | --- |
| `identifiable_publisher` | サイト | noul | このページから発行元を名指しできるか。見出しのブランド風の語だけでは足りない |
| `honest_identity` | サイト | noul | 表示がホストと一致するか。なりすましは要警戒。批評であること自体はなりすましではない |
| `site_purpose` | サイト | choice | 目的のラベル。報道・意見・一覧は通過。販売（報道に見せたアフィリエイト含む）・風刺は要確認。判別不能は要警戒 |
| `disclosed_incentives` | サイト | noul | 販売や働きかけがあるとき、誰が得をするかを出しているか |
| `evidence_for_claims` | 本文 | score | 主張がこのページ上の根拠で支えられているか。記事でないと対象外 |
| `separates_fact_and_opinion` | 本文 | noul | 事実と意見が読み分けられるか。エッセイであること自体は失敗ではない |
| `unsourced_specifics` | 本文 | choice | 出典のない具体値。宣伝の丸い数字も含む。`none` は pass、`some` は review、`many` は fail |
| `self_consistent` | 本文 | noul | 同じ事実が食い違っていないか。反復は矛盾ではない |
| `certainty_matches_evidence` | 本文 | noul | 断定の強さが根拠に見合っているか。健康・金・法はより強い根拠が要る |

サイトレーンは「誰か・なりすましか・何のためのページか・隠し勧誘か」です。本文レーンは「根拠・事実と意見・出典・矛盾・断定」です。意見であること自体は危険ではありません。一覧（リンクが多く、リンクあたりの本文が短い）は記事ではないので本文 5 問は走りません。パスが `/` だからポータル、特定の有名サイトだから通過、といった例外はありません。noul の通過は 0.8、choice / score の確信度の床は 0.6 で、迷ったら要確認です。コード側で見るのは HTTPS、著者・日付メタ、語数、リンク密度、外部ホスト、主本文が Jev の入力枠で切れたかです。収まる主本文は 1 回、超えたら重ねて分割し、切れ残りがあるとき本文 5 問（根拠・出典・矛盾・断定）は通過にしません。アプリ側の 1 万〜2 万文字キャップや URL ごとの例外では直しません。判定は通過 / 要確認 / 要警戒 / 対象外 / エラーの 5 種類で、一つの信頼スコアにはしません。定義を変えたら設定でリスト全体を再承認します。

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
