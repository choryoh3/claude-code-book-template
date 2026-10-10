# scripts/ — 補助スクリプト

アプリ本体ではない、開発を助ける Node.js のスクリプトです。

| スクリプト              | コマンド                      | 役割                                             |
| ----------------------- | ----------------------------- | ------------------------------------------------ |
| `logs-errors.mjs`       | `pnpm logs:errors [件数]`     | `logs/*.log` から直近の警告・エラーを一覧する    |
| `logs-trace.mjs`        | `pnpm logs:trace <requestId>` | 1 つのリクエストの全ログを時系列で表示する       |
| `build-screen-spec.mjs` | `pnpm spec:screens`           | 画面仕様書（Excel）を `docs/screens/` に生成する |

使い方の詳細は、各ファイル先頭のコメントと `docs/troubleshooting.md`、skill `debugging` を参照してください。
