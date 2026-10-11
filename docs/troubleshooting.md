# トラブルシューティング

実際に遭遇した問題の **症状 → 原因 → 対処** の記録です。同じ問題で悩む人（と AI）の時間を節約するために、新しいものを下に追記してください。

調査の進め方は skill `debugging`、`/debug` コマンドを参照。

---

## 環境構築

### `pnpm` が見つからない / `corepack enable` が EPERM で失敗する

- 症状: `pnpm : The term 'pnpm' is not recognized`。`corepack enable` で `EPERM: operation not permitted, open 'C:\Program Files\nodejs\pnpm'`
- 原因: Node のインストール先（`C:\Program Files`）への書き込みに管理者権限が必要
- 対処: 管理者権限なしで使える `npm i -g pnpm@10` を使う。新しいターミナルで `pnpm -v` を確認する（PATH が反映されない場合はターミナルを開き直す）

### pnpm 10 でインストールスクリプトが実行されない

- 症状: `bcrypt` や `esbuild` のネイティブビルドが動かない
- 原因: pnpm 10 は安全のため、依存のインストールスクリプトを既定で実行しない
- 対処: `pnpm-workspace.yaml` の `onlyBuiltDependencies` に必要なパッケージを追加する

## Lint / 整形

### `typescript-eslint does not support TS 7.0` で ESLint が起動しない

- 症状: 保存時の format hook や `pnpm lint` が上記のエラーで失敗する
- 原因: `pnpm add -D typescript` が最新の 7.x を入れたが、typescript-eslint が未対応
- 対処: TypeScript を `~5.9` に固定した（`package.json`）。typescript-eslint が TS 7 に対応したら ADR 0007 を見直してアップグレードする

### ESLint が `.mjs` で「型としてしか使われていない」と誤検知する

- 症状: `const a = 1; console.log(a)` のような普通のコードに `'a' is assigned a value but only used as a type`（`unused-imports/no-unused-vars`）
- 原因: ESLint 9/10 と @antfu/eslint-config の組み合わせで、`.mjs` に限って発生する（`.ts` では発生しない）。最小のファイルで再現し、設定やバージョンの変更では解消しなかった
- 対処: `eslint.config.mjs` で `**/*.mjs` に対してのみこの規則を無効化している。未使用変数は `.ts` では ESLint と `tsc` が検査する。解消されたら無効化を外す

### @antfu/eslint-config 9.x と ESLint の peer 依存が合わない

- 症状: `unmet peer eslint@>=10.4: found 9.x`
- 原因: antfu 9.x は ESLint 10 系を要求する。一方 ESLint 10 では上記の誤検知の切り分けが難しかった
- 対処: `@antfu/eslint-config@7.7.3`（ESLint `^9.10 || ^10` 対応）+ ESLint 9 に固定した

## Claude Code / hooks

### Bash コマンドが「rm -rf はブロックされています」で止まる

- 症状: コマンド内に `rm -rf` という **文字列** が含まれているだけで `guard-bash` に止められる（テスト用のスクリプトや説明文でも）
- 原因: hook はコマンド文字列を正規表現で検査するため、実行内容かどうかを区別できない
- 対処: 危険な文字列を含むテストはスクリプトファイル経由で実行する（例: hook のテストを `.mjs` に書いて `node` で実行）

### PowerShell から hook をテストすると終了コードが取れない

- 症状: パイプ + `Out-String` 経由だと、hook が 2 を返しているのに 0 に見える
- 原因: PowerShell 5.1 のパイプとネイティブコマンドの終了コードの扱い
- 対処: Node のスクリプトから `spawnSync` で hook を呼び、終了コードを直接比較する

### PostToolUse の format hook が Claude にエラーを返し続ける

- 症状: ファイルを書くたびに `eslint が ... を自動修正できませんでした`
- 原因: ESLint 自体が起動できない（上記の TS 7 の問題）、または自動修正できない違反が残っている
- 対処: まず `pnpm exec eslint <file>` を手で実行して原因を確認する。違反の場合はそのファイルを直す

### 完了時に音が鳴らない

- 確認: `node .claude/hooks/notify-sound.mjs done` を手で実行して鳴るか確認する。環境変数 `CLAUDE_SOUND_OFF=1` が設定されていないか確認する
- 設定の変更は新しいセッションで反映される

## DB

### seed の結果が実行のたびに変わる（再現性が崩れる）

- 症状: 同じ基準日で `pnpm db:seed` を 2 回実行しても、全テーブルのダイジェストが一致しない
- 原因: `updated_at` の既定値が `now()`（実行した時刻）で、seed が指定していなかった。古い投稿の更新日時が「実行時刻」になるのも不自然
- 対処: seed が `updated_at` を明示する（投稿・通報・ユーザー）。確認は `SEED_BASE_DATE=2026-10-11` を固定して 2 回実行し、全テーブルの行を `md5(string_agg(...))` で比較する
- 教訓: 既定値が `now()` の列は、seed で必ず明示する

### ハンドル・メールの検索で一意インデックスが使われない

- 症状: `WHERE handle = 'alice'` が一意インデックスではなくトライグラムのインデックスで検索される（件数が増えると遅い）
- 原因: 一意インデックスは `lower(handle)` に張っている（大文字小文字を区別しないため）。`handle = ...` では使えない
- 対処: 完全一致は `lower(handle) = lower($1)` と書く（`.claude/rules/db.md` に記載）

### psql の日本語が文字化けする / psql が見つからない

- 症状: PowerShell で `psql` を実行すると、メッセージが `�u�y�[�W...` のように化ける。または `psql` が見つからない
- 原因: Windows の既定のコードページ（Shift_JIS）と、PostgreSQL のクライアント側の文字コードの不一致。`psql` は PATH に入っていないことがある
- 対処: `$env:PGCLIENTENCODING = "UTF8"` を設定する。フルパス（`C:\Program Files\PostgreSQL\17\bin\psql.exe`）で実行する。SQL ファイルの結果が読めればデータ自体は正しい

### Date 型（date 列）の日付がずれる / 型が合わない

- 症状: `daily_active_users.active_date` が、実行環境のタイムゾーンによって 1 日ずれる、または型が `Date` なのに実際は文字列
- 原因: `pg` ドライバは date 列を「サーバーのタイムゾーンの 0 時の Date」に変換する。また kysely-codegen は date 列を `Date` 型として生成する
- 対処: `src/index.ts` で date を `'YYYY-MM-DD'` の文字列のまま扱う設定にし、`.kysely-codegenrc.json` の `overrides` で該当列の型を `string` に上書きした

## Lint / 整形（追加）

### Prettier と ESLint が 16 進数の大文字小文字で衝突する

- 症状: `0x6d2b79f5` を Prettier が小文字に直し、ESLint（`unicorn/number-literal-case`）が「大文字にせよ」と指摘する。保存のたびに互いに書き換える
- 原因: 2 つのツールの整形ルールの衝突
- 対処: 整形は Prettier に一本化する方針なので、ESLint 側の `unicorn/number-literal-case` を無効にした（`eslint.config.mjs` に理由を記載）

## Claude Code（追加）

### `.env` の存在確認や読み取りがブロックされる

- 症状: `Test-Path .env` などが「セキュリティのためブロックされた」と拒否される
- 原因: AI が秘密情報を見ないよう、`.env` の読み取りを権限で拒否している（`.claude/settings.json` の `permissions.deny`）
- 対処: 仕様どおり。接続先は環境変数 `DATABASE_URL`（無ければ開発用の既定値）で決まるので、`.env` が無くても動く。`.env` を作る・確認するのは人が行う

### `cd` したあとにコマンドの作業ディレクトリが変わったままになる

- 症状: Bash ツールで `cd` した後、次のコマンドが別のフォルダで実行される（`pnpm --filter ...` が失敗する）
- 対処: コマンドの先頭で `Set-Location "<リポジトリのルート>"` を実行するか、絶対パスを使う
