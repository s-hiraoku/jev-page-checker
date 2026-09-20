# Chrome ウェブストア掲載文

ダッシュボードへコピーする文面です。審査用の説明もここにあります。

## Store listing

- **Name:** Jev 信憑性チェッカー
- **Summary (132 文字以内):** 表示中のタブを追跡し、発行元と本文を Jev のチェックリストで分けて検査します。判定は根拠であり、ページの遮断や送信はしません。
- **Category:** Productivity
- **Language:** 日本語
- **Official URL:** https://github.com/s-hiraoku/jev-page-checker
- **Homepage:** https://s-hiraoku.github.io/jev-page-checker/
- **Support:** https://github.com/s-hiraoku/jev-page-checker/issues

### Description

Jev 信憑性チェッカーは、いま見ているページの発行元と本文を、承認済みの小さな質問で検査する Chrome 拡張です。文章を生成する chatbot ではありません。TypeSafe の Jev が、確率付きの判定を返します。

できること

- 表示中のタブを側面パネルが追跡し、読み込みや本文の変化に合わせて再検査する
- サイト（発行元・目的・利害の開示）と本文（根拠・事実と意見・出典のない具体値・矛盾・断定）を別レーンで見る
- 設定画面でチェックリスト全文を確認し、全体を承認してから Live 検査する
- 詳細画面で質問ごとと、Jev に送った本文を見直す

しないこと

- ページの遮断、書き換え、広告の挿入
- 判定を理由にした公開・送信・購入の自動実行
- 開発者サーバーへの本文や API キーの送信

使い方

1. 設定を開き、チェックリスト全体を承認する
2. TypeSafe の API キーを保存する
3. 調べたいページを開き、側面パネルで結果を読む

判定は通過 / 要確認 / 要警戒 / 対象外 / エラーです。一つの「信頼スコア」にはしません。pass は「チェックリスト上のその質問を通過した」という意味で、世の中の事実の証明ではありません。

## Privacy tab

- **Single purpose:** 表示中のウェブページの発行元と本文の信憑性を、利用者が承認した Jev チェックリストで検査する。
- **Remote code:** No, I am not using remote code.
- **Privacy policy URL:** https://s-hiraoku.github.io/jev-page-checker/privacy.html

### Permission justifications

- **sidePanel:** 表示中タブの検査結果を、読み続けられる側面パネルに出すため。
- **storage:** API キー、チェックリスト承認、直近の検査履歴を端末内に保存するため。
- **tabs:** 追跡中のタブの URL を知り、そのタブへ検査を割り当てるため。
- **host_permissions (http://\*/\* and https://\*/\*):** 表示中ページのタイトル、メタ情報、本文、外部リンクを読み取るため。http(s) 以外のページは検査しない。
- **host_permissions (https://api.typesafe.ai/\*):** 利用者が開始した検査だけを、TypeSafe の Jev へ 1 回送るため。

### Data use

収集するデータ

- Website content（URL、タイトル、メタ、本文）
- User activity（検査の開始、承認の保存）
- Personally identifiable information には当たらないが、利用者が任意で入れる API キーと承認者名

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

1. 設定でチェックリスト全文を承認し、承認者名を入れる。
2. TypeSafe API キーを入れる。審査用キーが必要な場合は GitHub Issues で連絡する。
3. https の記事ページを開き、ツールバーアイコンで側面パネルを出す。
4. Site / Page の 2 レーンと、質問ごとの判定が出ることを確認する。
5. 詳細を開き、送った本文が見えること、公開や送信のボタンが無いことを確認する。

キー無しでも `npm run preview` で replay 済みの画面を確認できる。
