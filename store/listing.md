# Chrome ウェブストア掲載文

ダッシュボードへコピーする文面です。審査用の説明もここにあります。

## Store listing

- **Name:** Jev Audit
- **Summary (132 文字以内):** いまの頁の発行元と本文を、Jev のチェックリストで分けて Audit します。判定は根拠であり、ページの遮断や送信はしません。
- **Category:** Productivity
- **Language:** 日本語
- **Official URL:** https://github.com/s-hiraoku/jev-page-checker
- **Homepage:** https://s-hiraoku.github.io/jev-page-checker/
- **Support:** https://github.com/s-hiraoku/jev-page-checker/issues

### Description

Jev Audit は、いま見ているページの発行元と本文を、承認済みの小さな質問で見る Chrome 拡張です。文章を生成する chatbot ではありません。TypeSafe の Jev が、確率付きの判定を返します。

できること

- 表示中のタブを Inspector が追跡し、読み込みや本文の変化に合わせてやり直す
- Chrome ツールバーの常駐アイコンでサイト（上段）と本文（下段）の判定を色とバッジで常時示す
- サイトの安全性（発行元・なりすまし・目的・利害の開示）と本文の精査（根拠・事実と意見・出典のない具体値・矛盾・断定）を別レーンで見る。一覧ページは本文を対象外にする
- Settings でチェックリスト全文を確認し、全体を承認してから Live で Audit する
- Report で質問ごとと、Jev に送った文を見直す

しないこと

- ページの遮断、書き換え、広告の挿入
- 判定を理由にした公開・送信・購入の自動実行
- 開発者サーバーへの本文や API キーの送信

使い方

1. 設定を開き、チェックリスト全体を承認する
2. TypeSafe の API キーを保存する
3. 調べたいページを開き、Inspector で結果を読む

判定は Pass / Review / Alert / N/A / Error です。一つの「信頼スコア」にはしません。Pass は「チェックリスト上のその質問を通過した」という意味で、世の中の事実の証明ではありません。

## Privacy tab

- **Single purpose:** 表示中のウェブページの発行元と本文を、利用者が承認した Jev チェックリストで Audit する。
- **Remote code:** No, I am not using remote code.
- **Privacy policy URL:** https://s-hiraoku.github.io/jev-page-checker/privacy.html  
  リポジトリの Settings → Pages で Source を `main` / `docs` にしてから使う。公開前は `docs/privacy.html` の内容がソースです。

### Permission justifications

- **sidePanel:** 表示中タブの結果を、読み続けられる Inspector に出すため。
- **storage:** API キー、チェックリスト承認、直近の履歴を端末内に保存するため。
- **tabs:** 追跡中のタブの URL を知り、そのタブへ Audit を割り当てるため。
- **host_permissions (http://\*/\* and https://\*/\*):** 表示中ページのタイトル、メタ情報、本文、外部リンクを読み取るため。http(s) 以外のページは対象にしない。
- **host_permissions (https://api.typesafe.ai/\*):** 利用者が開始した Audit だけを、TypeSafe の Jev へ 1 回送るため。

### Data use

収集するデータ

- Website content（URL、タイトル、メタ、本文）
- User activity（Audit の開始、承認の保存）
- Personally identifiable information には当たらないが、利用者が任意で入れる API キー

使わないデータ

- 位置情報、健康、財務、認証以外の通信内容、個人の連絡先

証明

- データの販売はしない
- 利用目的以外に使わない
- クレジット供与や融資の判断に使わない

## Distribution

- **Visibility:** Public
- **Regions:** All regions（必要なら日本のみ）
- **Pricing:** Free

## Test instructions

1. 設定でチェックリスト全文を承認する。
2. TypeSafe API キーを入れる。審査用キーが必要な場合は GitHub Issues で連絡する。
3. https の記事ページを開き、ツールバーアイコンで Inspector を出す。
4. Site / Page の 2 レーンと、質問ごとの判定が出ることを確認する。
5. Report を開き、送った文が見えること、公開や送信のボタンが無いことを確認する。

キー無しでも `npm run preview` で replay 済みの画面を確認できる。
