# 信頼性 10 分類の問いバッテリー（ドラフト）

状態はクライアント配線のみである。Jev API での実測は未実施で、欠測である。合格線と重みは未確定で、欠測である。本番の TypeSafe 定義への反映は対象外である。

## 本文 11 とサイト固定 4 との関係

`content_class` は、ページを 10 分類のどれに近いかで切り替え、その分類の Choice / Score / Noul を聞く。総合信頼度はコードが向きのある回答だけを等重みで平均する。一問の総合信頼度は作らない。この平均は判定チップにしない。`applied` は false のままである。

本文の 11 分類（`CONTENT_CATEGORY_IDS`）と、サイトの固定 4 問（`identifiable_publisher`、`honest_identity`、`site_purpose`、`disclosed_incentives`）はチェックリストに残る。バッテリーの質問 ID はそのリストに入れない。定義版は 10 のままである。

10 個の ID は、未マージのサイト種別タクソノミ（`SITE_TYPE_IDS`）と同じ並びである。この変更はタクソノミを実装しない。サイト種別の分類結果をあとから渡す口は `supplied` である。渡さないときは `content_class` を聞き、10 個の外の回答や失敗は `unknown_other` のバッテリーに回す。

## 状態

Jev に渡す状態は、タイトル、サイト名、著者、説明、公開日、言語、本文の先頭スライスである。URL とホスト名は渡さない。既知のホストで分類を曲げないためである。長文の窓をまたいだバッテリーは未実装である。

## 重み

ドラフトが向きを書いた問いだけを平均する。根拠が厚い、出典がある、較正されている、は高いほど信頼側である。煽り、販促、不透明さ、根拠のない絶対表現、は高いほど信頼の逆側である。向きが書いていない問いと、中立と書いた訂正表示は平均に入れない。機械生成のシグナルも平均に入れない。重みはすべて 1 で、`draft-equal` とラベルする。

## English

`content_class` selects one of ten batteries. The code averages only the answers whose draft states a direction. That average is not a verdict. Body-11 and the four site checks stay on the approved checklist at definition version 10. The ten ids match the unmerged `SITE_TYPE_IDS` list. This change does not implement that taxonomy. Jev live verification, the composite threshold, and tuned weights are unset.
