# packages/ — 共有パッケージ

`user` と `admin` の **両方から使う部品** を置く場所です。変更すると両方のアプリに影響するので、変更後は必ず `pnpm check` を実行してください。

| パッケージ | 役割                                                                       | 規約                                |
| ---------- | -------------------------------------------------------------------------- | ----------------------------------- |
| `db/`      | PostgreSQL への接続（Kysely）、SQL マイグレーション、テストデータ（seed）  | `.claude/rules/db.md`               |
| `shared/`  | Zod スキーマ・型・定数・Socket.IO のイベント型（**API 契約の唯一の真実**） | `.claude/rules/shared-contracts.md` |
| `ui/`      | デザイントークン（`src/tokens.css`）、共通の Vue コンポーネント            | `.claude/rules/styling.md`          |

依存の向き: `user/*`・`admin/*` → `shared` / `db` / `ui`。パッケージ側からアプリ側を参照しません。
実装は Phase 1（db）と Phase 2（shared・ui）です。
