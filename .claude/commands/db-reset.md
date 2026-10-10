---
description: 開発 DB を初期化してマイグレーションと seed をやり直す（必ずユーザー確認つき）
disable-model-invocation: true
---

開発用データベース `xclone` を **全削除して作り直します**。

## 手順

1. **確認（必須）**: 接続先（`DATABASE_URL` のホスト・DB 名）を示し、全データが消えることを明示して、
   ユーザーから明確な「はい」をもらう。得られなければ中止する
2. 許可フラグを作成する（`guard-bash` hook は、このフラグがある間だけリセット系の操作を通す。10 分で失効）

   ```powershell
   New-Item -ItemType File -Force .claude/.db-reset-allowed
   ```

3. リセットを実行する（全テーブルを削除 → 全マイグレーション適用 → seed 投入）

   ```powershell
   pnpm db:reset
   ```

4. **成否にかかわらず** フラグを削除する

   ```powershell
   Remove-Item -Force .claude/.db-reset-allowed -ErrorAction SilentlyContinue
   ```

5. `pnpm db:codegen` で型が最新か確認し、結果（適用マイグレーション数、seed の投入件数）を報告する。
   テストアカウントは `docs/test-data.md` を案内する

本番や共有 DB が接続先になっている疑いがあれば、実行せずユーザーに確認すること。
