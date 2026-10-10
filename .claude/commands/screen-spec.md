---
description: 実画面を Playwright MCP でキャプチャし、画面仕様書（Excel）を再生成する
argument-hint: [画面ID（例 U-03）または 空欄で全画面]
---

画面仕様書 `docs/screens/画面仕様書.xlsx` を最新の実画面で更新してください。対象: $ARGUMENTS（空欄なら全画面）

## 手順

1. **前提の確認**: `pnpm dev` で user / admin が起動していること、`pnpm db:seed` でテストデータが入っていること（`docs/test-data.md`）。
   起動していなければ、起動が必要だとユーザーに伝える（画面が未実装の画面は、その旨を報告してスキップする）
2. **キャプチャ対象の洗い出し**: `docs/screens/specs/user-screens.mjs` と `admin-screens.mjs` の各画面の `captures`（ファイル名のベース）を読む
3. **撮影**: `ui-verifier` エージェント（Playwright MCP）に依頼して、各キャプチャを `docs/screens/captures/<名前>.png` に保存する
   - 名前の末尾でビューポートとテーマを決める: `-light` / `-dark`（ダークはテーマ切替または `prefers-color-scheme`）、`-mobile`（390×844）、`-tablet`（1024×768）、それ以外はデスクトップ（1440×900）
   - `-empty` / `-error` / `-validation` / `-suspended` などの状態は、`docs/test-data.md` のアカウントとデータで作る（空状態は eve、凍結は dave など）
   - ログインが必要な画面は、テストデータのアカウントでログインしてから撮る。**パスワードなどが画面に映り込まないこと**
4. **画面定義の更新**: 実装済みになった画面は、定義の `status` を `'実装済み'` にし、画面の実際の項目・文言・動作と定義が食い違っていれば定義を直す
5. **Excel を再生成**: `pnpm spec:screens`。取得済み枚数（`n / 46`）を確認する
6. **報告**: 撮影できた画面・できなかった画面（理由）、仕様と実装の差異、更新したファイルを簡潔に報告する。
   `docs/progress.md` に記録する

## 注意

- キャプチャは個人情報を含まないテストデータだけで撮る
- 画像は `docs/screens/captures/` にコミットしてよい（1 枚 500KB 程度に抑える）
