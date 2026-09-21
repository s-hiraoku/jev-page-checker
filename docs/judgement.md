# 判定の原則

この製品は、知っているサイトを緑にするものではない。今見ているページについて、サイトの安全性と、記事があるときだけの本文の精査を、根拠として出す。ページは遮断しない。判定を理由に、公開や転送もしない。迷ったら要確認である。

## 禁止。局所対応

あるサイトの結果が望ましくないからといって、そのサイトだけ通るように合格線、指示、URL、ホストを曲げてはならない。その直しはそのサイトでしか働かず、他のページでは同じ失敗が残る。

やってはならないこと。

- 画面に出た noul、score、確信度に合わせて、`passAt` や `confidenceFloor` を動かす。
- 定義やコードに、特定のホスト、著者、記事の名前を書く。
- パスが `/` だから、または有名なサイトだから、という分岐を入れる。
- 「このサイトは記事ではない」「このサイトは信頼できる」をコードに書く。
- replay に実在サイトの点数を写して、それを合格条件にする。

直すときは、聞いていること、構造の見分け、閾値の意味を、どの URL でも同じ規則になるように直す。

## やってよいこと

- サイトでは、誰が責任者か、なりすましか、何のためのページか、隠し勧誘かを聞く。
- 本文は、一本の文章があるときだけ聞く。聞くのは、根拠、事実と意見、出典、矛盾、断定である。
- 本文の各問では、ページから切った文のうち一本を Jev に選ばせる。選ばれた文を根拠として出す。Jev に文を書かせない。none、または確信度 0.6 未満のときは出さない。この選択は合否を動かさない。切り方はどの URL でも同じである。
- 利害の開示は三択である。勧誘がない、または受益者が書いてある、は Pass。隠しているは Alert。確信度の床は 0.6 である。
- 本文の精査は、抜き出した主本文の全体を見る。Jev の入力枠は、state と最長の質問で 32,000 トークン、1 回のリクエストで 64,000 トークンである。これは公式の Models の値である。収まるときは 1 回で送る。超えたら重ねて分割し、厳しめにまとめる。切れ残りがあるときだけ、本文は通過にしない。上限はどの URL でも同じである。サイト全体は見ない。
- 一覧は、リンク密度などのページ構造で見る。ホストもパスも見ない。
- 意見・分析は目的のラベルである。それ自体は危険ではない。
- Jev には意味だけを聞く。HTTPS、メタ情報、語数、リンク密度、本文が入力枠で切れたか、分割の合成は、コードが見る。
- noul の通過は 0.8 である。choice と score の確信度の床は 0.6 である。意味で決めた線であり、一つの画面に合わせない。
- 定義を変えたら、リスト全体を承認し直す。一部だけの承認はしない。
- 仮説、未検証、実験が必要と本文に書いてある提案は、出典のない報道の断定と同じ失敗にしない。出典や計測がない提案は、通過ではなく要確認である。
- 発行元は、画面の著者、署名、発行者の表示を見る。主本文からナビゲーションとして外したことは、発行元がいないことではない。

## English

This product does not turn a familiar site green. For the page you are looking at, it reports evidence about site safety, and about the body only when the page is one piece of writing. It does not block the page. A verdict is not a reason to publish or forward the page. If the result is uncertain, the verdict is Review.

Do not bend the pass line, the instructions, a URL, or a host so that one site gets the result you want. That fix works only on that site. The same failure remains on every other page.

Do not do any of these.

- Move `passAt` or `confidenceFloor` to match an noul, a score, or a confidence that appeared on one screen.
- Put a particular host, author, or article name in the definition or the code.
- Branch because the path is `/`, or because the site is famous.
- Encode "this site is not an article" or "this site is trustworthy".
- Copy a real site's scores into replay and treat them as the pass condition.

When you fix something, change the question, the structural distinction, or the meaning of a threshold so the same rule applies to every URL.

What the check may do:

- Site questions ask who is responsible, whether the page impersonates someone, what the page is for, and whether a pitch hides who benefits.
- Body questions run only when there is one piece of writing. They ask about evidence, fact and opinion, sources, contradiction, and certainty.
- For each body question, Jev selects one sentence cut from the page. The report shows that sentence. Jev does not write it. none, or confidence below 0.6, shows no sentence. The selection does not change the verdict. The cut is the same for every URL.
- Disclosure is a three-way choice. No pitch, and a named beneficiary, pass. Hiding who benefits is Alert. The confidence floor is 0.6.
- Body review covers the extracted main text. Jev's input window is 32,000 tokens for state plus the longest question, and 64,000 tokens per request. Those are the official Models limits. A body that fits is sent once. A longer body is split with overlap and combined strictly. If any remainder is unread, the body does not pass. The limit is the same for every URL. The checker does not read the whole site.
- A listing is recognized from page structure, such as link density. Host and path are not inputs.
- Opinion and analysis are a purpose label. The label itself is not a failure.
- Jev is asked for meaning only. The code judges HTTPS, metadata, word count, link density, whether the body was cut by the input window, and how split windows are combined.
- Noul passes at 0.8. The confidence floor for choice and score is 0.6. Those lines were chosen for their meaning. They are not fitted to one case.
- If the definition changes, the whole list must be accepted again. A partial acceptance is not enough.
- A proposal that the text marks as a hypothesis, as unverified, or as needing an experiment is not the same failure as an unsourced news assertion. A proposal with no source or measurement is Review, not Pass.
- Publisher identity uses the author, byline, and publisher chrome on the page. Removing navigation from the main text does not mean there is no publisher.
