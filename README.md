# Signal Studio

GitHub Pagesで公開する、分析向けマイクロツール集です。目的は2つです。

1. 実際に使われる静的Webページを置いて、GA4で行動データを集める
2. その後にBigQueryやデータ基盤構築の練習へつなげる

## なぜこの構成か

単なる作品集やブログより、実用ツールの方が次のデータを取りやすいです。

- 流入後にどのツールを選んだか
- 入力を始めたか
- 生成を完了したか
- 結果をコピーしたか
- どの意図や条件で使われたか

このリポジトリでは次の5ページを中核にしています。

- `index.html`: ランディングページ。自己選択の役割と目的も取得
- `meeting-cost.html`: 会議コスト試算
- `timezone-planner.html`: タイムゾーン重なり候補の生成
- `launch-planner.html`: ローンチ用チェックリスト生成
- `utm-builder.html`: UTM付きURL生成

## GA4イベント設計

共通計測は [`assets/analytics.js`](./assets/analytics.js) にまとめています。

### 共通イベント

- `page_view`
- `scroll_milestone`
- `outbound_click`
- `copy_result`
- `tool_interaction_started`

### ランディングページ

- `hero_cta_click`
- `tool_card_click`
- `role_selected`
- `goal_selected`
- `faq_opened`

### ツール別イベント

- `meeting_cost_calculated`
  - `attendee_count_bucket`
  - `duration_min`
  - `monthly_frequency`
  - `monthly_cost_bucket`
- `timezone_plan_created`
  - `city_count`
  - `duration_min`
  - `best_score`
- `launch_checklist_generated`
  - `objective`
  - `risk_level`
  - `market_count_bucket`
  - `analytics_maturity`
  - `addon_count`
- `utm_built`
  - `source`
  - `medium`
  - `campaign_length_bucket`
  - `has_term`

### user_properties

- `role`
- `goal`

## 後でやるとよい分析

- ホームから各ツールの生成完了までのファネル比較
- `role` や `goal` ごとのツール選好分析
- `copy_result` をゴールにした完了率比較
- UTM Builder利用者と他ツール利用者の再訪比較
- `source / medium` や `objective` などのカテゴリ別集計

## 公開メモ

GA4の測定IDは現状 `G-P6HSYY8Z3X` を直書きしています。環境を分けたくなったら、将来的には次のどちらかに寄せると扱いやすいです。

- GitHub Actionsでビルド時に埋め込む
- `site-config.js` のような設定ファイルに切り出す

## 次の改善候補

- 各ツールにSEO向けの使い方記事を追加する
- FAQやテンプレート集を足して流入面を強化する
- GA4からBigQuery exportして、セッション集計ビューを作る
- Looker Studioやdbtで学習用ダッシュボードを作る
