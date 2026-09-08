# mcp-agri

農林水産省の卸売市場調査データ（e-Stat API 経由）を提供する MCP サーバー。

デフォルトでは「青果物卸売市場調査」(統計調査コード `00500226`) を対象にするが、
`search_market_price_tables` の `statsCode` を変えれば他の卸売市場統計（畜産物・米穀など）も検索できる。

## セットアップ

1. e-Stat のアプリケーションIDを取得する（無料）: https://www.e-stat.go.jp/mypage/user/preregister
2. `.env.example` を `.env` にコピーし `ESTAT_APP_ID` を設定する
3. 依存関係をインストール: `pnpm install`（リポジトリルートで）
4. 起動: `pnpm --filter mcp-agri dev`（デフォルトで `http://localhost:3003/mcp/agri-price`）

## ツール

- `search_market_price_tables` — キーワードで統計表を検索し `statsDataId` を得る
- `get_market_price_table_meta` — 統計表の品目/市場/期間コード一覧（メタ情報）を取得
- `get_market_price_data` — `statsDataId` とコードを指定して実データを取得
- `find_market_price` — 品目名・市場名・年月から上記3つを一括で行う簡易版（ベストエフォート。曖昧な場合は上記を個別に使うこと）

## 認証

`MCP_AGRI_API_KEY` を設定すると、リクエストヘッダー `x-api-key` による認証が必須になる。
未設定時はローカル開発向けに無認証で動作する。
