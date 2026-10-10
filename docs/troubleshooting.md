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
