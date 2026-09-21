# Chrome ウェブストア掲載文

ダッシュボードへコピーする文面です。審査用の説明もここにあります。ストアの言語は日本語です。英語は、同じ内容を審査者と README で読むための文です。

## Store listing

- **Name:** Jev Audit
- **Summary (132 文字以内):** いまのページの発行元と本文を、Jev のチェックリストで分けて Audit します。判定は根拠です。ページの遮断や、判定を理由にした送信はしません。
- **Category:** Productivity
- **Language:** 日本語
- **Official URL:** https://github.com/s-hiraoku/jev-page-checker
- **Homepage:** https://s-hiraoku.github.io/jev-page-checker/
- **Support:** https://github.com/s-hiraoku/jev-page-checker/issues

### Description

Jev Audit は、いま見ているページの発行元と本文を、承認したチェックリストで見る Chrome 拡張です。文章は生成しません。見るのは、いまのページだけです。TypeSafe の Jev が、確信度つきの判定を返します。

できること

- Inspector は表示中のタブに追従し、読み込みや本文の変化に合わせてやり直す
- Chrome ツールバーのアイコンで、サイト（上段）と本文（下段）の判定を色とバッジで示す
- サイト（発行元、なりすまし、目的、利害の開示）と本文（根拠、事実と意見、出典のない具体値、矛盾、断定）を別のレーンで見る。一覧ページでは本文を見ない
- Settings でチェックリストを読み、リスト全体を承認してから Audit する
- Report で、質問ごと、ページから既に分かっている事実、Jev に送った文を見る。結果は端末内のファイルに残せる。外部へ送るボタンはない
- 過去の Audit は History に、Audit した時刻つきで残る。1 件ずつ消せる

しないこと

- ページの遮断、書き換え、広告の挿入
- 判定を理由にした公開、送信、購入の自動実行
- 開発者のサーバーへの本文や API キーの送信

使い方

1. Settings を開き、チェックリスト全体を承認する
2. TypeSafe の API キーを保存する
3. 調べたいページを開き、Inspector で結果を読む

判定は Pass、Review、Alert、N/A、Error です。一つの信頼スコアにはしません。Pass は、その質問をチェックリスト上で通過したという意味です。世の中の事実を証明したという意味ではありません。

### English description

Jev Audit is a Chrome extension that checks the publisher and the body of the page you are reading, with a checklist you have accepted. It does not write text. It looks only at the current page. TypeSafe Jev returns a verdict with a confidence.

What it does

- Inspector follows the open tab and runs again when the page loads or the body changes
- The toolbar icon shows the site verdict on top and the body verdict below, with color and a badge
- Site questions (publisher, impersonation, purpose, disclosed interests) and body questions (evidence, fact and opinion, unsourced figures, contradiction, certainty) are separate lanes. A listing page skips the body
- In Settings, read the checklist and accept the whole list before Audit
- Report shows each question, facts already taken from the page, and the text sent to Jev. You can keep the result as a file on the device. There is no button that sends it out
- History keeps past Audits with the time of each check. You can delete one record

What it does not do

- Block a page, rewrite it, or insert ads
- Publish, send, or buy anything because of a verdict
- Send the body or the API key to a server run by the developer

How to use it

1. Open Settings and accept the whole checklist
2. Save a TypeSafe API key
3. Open the page you want to check and read the result in Inspector

Verdicts are Pass, Review, Alert, N/A, and Error. There is no single trust score. Pass means that question cleared the checklist. It does not prove the claim is true in the world.

## Privacy tab

- **Single purpose:** 表示中のウェブページの発行元と本文を、利用者が承認した Jev のチェックリストで Audit する。
- **Remote code:** No, I am not using remote code.
- **Privacy policy URL:** https://s-hiraoku.github.io/jev-page-checker/privacy.html  
  リポジトリの Settings → Pages で、Source を `main` の `docs` にしてから使う。公開前の原文は `docs/privacy.html` です。

### Permission justifications

- **sidePanel:** 表示中のタブの結果を、読み続けられる Inspector に出すため。
- **storage:** API キー、チェックリストの承認、History を、この端末の中に保存するため。
- **tabs:** 追従しているタブの URL を知り、そのタブに Audit を割り当てるため。
- **host_permissions (http://\*/\* and https://\*/\*):** 表示中のページのタイトル、メタ情報、本文、外部リンクを読むため。http と https 以外のページは対象にしない。
- **host_permissions (https://api.typesafe.ai/\*):** 利用者が開始した Audit を、TypeSafe の Jev へ送るため。長い本文は、同じ API へ複数回に分けることがある。それ以外の宛先はない。

### Data use

集めるデータ

- Website content（URL、タイトル、メタ情報、本文）
- User activity（Audit の開始、承認の保存）
- 利用者が自分で保存する API キー。連絡先や氏名としては集めない。ログには出さない

扱わないデータ

- 位置情報、健康、財務、個人の連絡先
- 見ているページ以外の通信内容

証明

- データの販売はしない
- 上の目的以外には使わない
- 与信や融資の判断には使わない

## Distribution

- **Visibility:** Public
- **Regions:** All regions。掲載地域を絞る理由はない。
- **Pricing:** Free

## Test instructions

1. Settings でチェックリスト全体を承認する。
2. TypeSafe の API キーを入れる。審査用のキーが要るときは、GitHub Issues で連絡する。
3. https の記事ページを開き、ツールバーのアイコンから Inspector を出す。
4. サイトと本文の 2 レーンと、質問ごとの判定（Pass、Review、Alert、N/A、Error）が出ることを確認する。
5. Report を開く。タイトル、公開日、ページの形、外部ホスト、送った文が見えること。外部へ送るボタンは無いこと。「この端末にファイルで残す」があること。
6. History を開く。過去の Audit が「Audit した時刻」つきで並ぶこと。1 件だけ消せることを確認する。

キーが無くても、`npm run preview` で記録済みの画面を確認できる。
