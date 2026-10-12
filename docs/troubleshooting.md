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

### 保存のたびに ESLint が「使っていない import」を消してしまう

- 症状: 先に `import { foo } from '...'` だけを足して保存すると、その import が消える（次に `foo` を使うコードを足すと「`foo` が定義されていない」エラーになる）
- 原因: 保存時の hook（`format.mjs`）が `eslint --fix` を実行し、**使われていない import を自動で削除**する
- 対処: **使うコードを先に書いてから、import を足す**（または、使うコードと import を 1 回の編集で一緒に書く）。型エラー `Cannot find name 'xxx'` が出たら、import が消えていないか疑う

### Actions のワークフローを、ローカルで動作確認する方法

- GitHub の Actions 自体は、GitHub 上でしか動かせない。ローカルでは次を確認できる
  1. YAML の構文（`yaml` パッケージで読み込む）と、`needs` / `outputs` / `steps.<id>` の参照先が存在するか
  2. 各 `run` ブロックの bash の構文（`bash -n`）
  3. ログ出力だけで完結するステップは、環境変数（`GITHUB_RUN_ID` `GITHUB_STEP_SUMMARY` `GITHUB_OUTPUT` など）を模擬して、実際に実行できる
- ESLint の YAML 規則は「引用符なしの書き方（plain scalar）」を求める。`eslint --fix` で直す（Prettier と衝突しないことを確認済み）

## テスト

### Vitest が「Failed to start forks worker ... Timeout waiting for worker to respond」で失敗する

- 症状: `pnpm check` の途中で、ui のテストが「テスト 0 件・エラー 4 件」で失敗する。テストの中身の失敗ではない
- 原因: 型チェック・lint の直後で PC の負荷が高く、テスト用のワーカープロセスが時間内に起動しなかった（一時的なもの）
- 確認: `pnpm --filter "@xclone/ui" test` を単独で、または `pnpm test` をもう一度実行すると通る（2026-10-11 に再現しないことを確認）
- 対処: 再実行する。頻発するようになったら、Vitest の設定でワーカー数を減らす・`pool` を変えるなどを検討し、ここに記録する

## サーバー（Phase 3）

### トランザクションの中で例外を投げたら、その前の更新が消えた

- 症状: refresh token の盗用を検知して「全トークンを失効」させたのに、失効していなかった（テスト「交換済みの古い Cookie が再び使われたら…」が失敗）
- 原因: 失効の UPDATE の直後に、同じトランザクションの中で例外を投げていた。例外でトランザクション全体がロールバックされ、失効も取り消された
- 対処: トランザクションからは「結果（盗用の疑い・凍結）」を返し、**トランザクションの外で**失効させてから例外を投げる（`user/server/src/services/auth.service.ts` の refresh）
- 教訓: 「エラーにするが、記録は残したい」処理はトランザクションの外で行う

### Vitest の `test.env` が globalSetup に届かない

- 症状: テスト用 DB を準備する globalSetup で `DATABASE_URL` が空になり、`Invalid URL` で失敗する
- 原因: Vitest 5 の `test.env` はテストの実行側にだけ渡り、全体の準備（globalSetup）には渡らない
- 対処: `vitest.config.ts` の読み込み時に `Object.assign(process.env, TEST_ENV)` で環境変数そのものを設定する（`user/server/vitest.config.ts`）

### Express の Request に独自の項目（req.auth）を足す型定義が効かない

- 症状: `declare module 'express-serve-static-core'` で拡張したのに `Property 'auth' does not exist`
- 原因: pnpm では `express-serve-static-core` が直接の依存ではないため、その名前で拡張すると「別の新しいモジュール」の宣言になる
- 対処: Express が用意しているグローバルの `Express.Request` を拡張する（`user/server/src/types/express.d.ts`）

### import の並べ替えで、ファイル先頭の説明コメントが import の間にずれる

- 症状: 保存時の ESLint（perfectionist/sort-imports）で、先頭の `// このファイルは…` が 2 行目以降の import の上に移動する
- 原因: 説明コメントが「最初の import に付いたコメント」と見なされ、import と一緒に並べ替えられる
- 対処: **説明コメントの後に空行を 1 行入れる**（空行で切り離すと並べ替えの対象にならない）

### `.env.example` が AI から読めない

- 症状: `.env.example` を Read しようとすると「権限の設定で拒否されています」になる
- 原因: `.claude/settings.json` の `permissions.deny` の `Read(./.env.*)` が、見本ファイル（秘密ではない）にも当てはまっている
- 対処（未実施・人の判断待ち）: 拒否の対象を `Read(./.env)`・`Read(./.env.local)`・`Read(./.env.*.local)`・`Read(./.env.production)` などの秘密ファイルに絞る

## E2E（Playwright）

### 最初のテストだけ、登録が終わらずに失敗する（起動直後の遅さ）

- 症状: E2E の 1 件目で「登録する」を押したあと、ボタンが「処理中」のまま 15 秒たって失敗する。2 件目以降は通る
- 調べ方: 失敗時に残る `e2e/test-results/*/trace.zip` を展開し、`*.network` の通信の記録で各 API の所要時間を見た（`pnpm exec playwright show-trace <trace.zip>` でも見られる）
- 原因: 登録自体は成功（201）していたが、起動直後の最初の要求だったため 13 秒かかっていた（DB への接続の確立・Vite による画面のファイルの初回変換・同じ PC で動く他の処理の負荷が重なった）
- 対処: テストの前に「慣らし運転」をする（`e2e/warm-up.ts`: API を 1 回呼び、主な画面を一度開く）。登録の完了待ちは 30 秒にした
- 教訓: E2E の失敗は、まず trace の通信の時間を見る（「動かない」のか「遅い」のかを分ける）

### フォローしたのに「フォロー中」のボタンが見つからない

- 症状: E2E で「フォロー」を押したあと、`getByRole('button', { name: 'フォロー中' })` が見つからずに失敗する（フォロー自体は 200 で成功している）
- 原因: X と同じく、「フォロー中」のボタンは **マウスを乗せると「フォロー解除」に表示が変わる**。クリックした直後はマウスがボタンの上にあるので、名前が「フォロー解除」になっていた
- 対処: 「フォロー中」「フォロー解除」のどちらでもフォロー済みとみなす（`e2e/pages/app.ts`）
- 教訓: 失敗時の `error-context.md`（ページの状態）を見ると、実際の表示がすぐ分かる
