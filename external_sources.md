# StudyJournal 外部ソース記録

## GDELT DOC API

StudyJournalの「今日のニュースを題材に生成」では、記事本文を保存・転載せず、GDELT DOC APIから取得した**見出し、出典URL、出典ドメイン**のみをトピック入力として扱います。生成される読解は学習用にAIが新規作成するものであり、元記事の要約や転載ではありません。

| 項目 | URL | 実装上の扱い |
| --- | --- | --- |
| GDELT Data | https://www.gdeltproject.org/data.html | 公開データとリアルタイムAPIの存在を確認。 |
| GDELT DOC API | https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/ | `artlist` JSON形式で記事一覧を取得。HTTPS URLのみを受理。 |

## NHK RSS

NHKは公式RSSの一覧を公開していますが、同ページにはRSSの再配信・再提供に関する注意が記載されています。そのため、現実装ではNHK RSSを自動取得元として組み込まず、将来導入する場合は学校・組織側で利用条件を確認したうえで、取得範囲と保存方針を決定します。

| 項目 | URL |
| --- | --- |
| NHK ONE ニュースRSS | https://www.nhk.or.jp/toppage/rss/index.html |
| NHK WORLD RADIO JAPAN English News RSS | https://www3.nhk.or.jp/rj/podcast/rss/english.xml |
