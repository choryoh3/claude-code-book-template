# ADR（Architecture Decision Records）

「**なぜそう決めたか**」の記録です。コードを読んでも分からない理由を残し、後から来た人（人間でも AI でも）が同じ議論を繰り返さないようにします。
新しい ADR は `/adr <タイトル>` で作成します。

| 番号                                               | タイトル                                                | ステータス |
| -------------------------------------------------- | ------------------------------------------------------- | ---------- |
| [0001](./0001-monorepo-and-app-separation.md)      | pnpm モノレポで管理者アプリとユーザーアプリを分ける     | 採用       |
| [0002](./0002-pinia-for-state-management.md)       | 状態管理に Pinia を使う                                 | 採用       |
| [0003](./0003-kysely-and-sql-migrations.md)        | DB アクセスは Kysely + SQL マイグレーション             | 採用       |
| [0004](./0004-jwt-auth-strategy.md)                | JWT 認証（access はメモリ、refresh は httpOnly Cookie） | 採用       |
| [0005](./0005-tailwind-v4-and-design-tokens.md)    | Tailwind CSS v4 + デザイントークン                      | 採用       |
| [0006](./0006-claude-code-operating-foundation.md) | Claude Code の運用基盤                                  | 採用       |
| [0007](./0007-toolchain-version-pins.md)           | ツールのバージョン固定                                  | 採用       |
| [0008](./0008-shared-and-ui-package-choices.md)    | shared と ui の設計と、ライブラリの選び方               | 採用       |

## ルール

- 決定を変えるときは、古い ADR を消さずにステータスを「廃止（置き換え先: NNNN）」にして、新しい ADR を作る
- 背景・選択肢・理由・結果を、初心者にも伝わる言葉で書く
