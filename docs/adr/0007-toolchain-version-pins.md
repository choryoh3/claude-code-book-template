# 0007. ツールのバージョンを固定する（TypeScript 5.9 / ESLint 9 / antfu config 7.7）

- ステータス: 採用（見直し条件あり）
- 日付: 2026-10-11

## 背景

`pnpm add` で最新版を入れたところ、次の問題が起きた（詳細は `docs/troubleshooting.md`）。

- TypeScript 7.0 は typescript-eslint が未対応で、ESLint が起動しなかった
- `@antfu/eslint-config` 9.x と ESLint の組み合わせで、`.mjs` に誤検知が出て切り分けが難しかった

## 決定

動作確認できた組み合わせに **固定** する。

| ツール               | バージョン             | 理由                                        |
| -------------------- | ---------------------- | ------------------------------------------- |
| Node                 | 22（`.nvmrc`）         | 指示どおり。LTS                             |
| pnpm                 | 10（`packageManager`） | 指示どおり                                  |
| TypeScript           | `~5.9`                 | typescript-eslint が対応している最新系      |
| ESLint               | `^9`                   | antfu config 7.7 が対応（`^9.10 \|\| ^10`） |
| @antfu/eslint-config | `7.7.3`                | 上記の組み合わせで動作確認済み              |

## 見直しの条件

- typescript-eslint が TypeScript 7 に対応したら TypeScript をアップグレードする
- `.mjs` の誤検知が解消されたら `eslint.config.mjs` の無効化を外す

アップグレードは **単独の変更** として行い、`pnpm lint` / `pnpm typecheck` / `pnpm test` が通ることを確認する。

## 結果

- 良い点: 誰の環境でも同じ結果になり、AI の自動整形（hooks）も安定する
- 注意点: 古いバージョンのままにならないよう、Phase ごとに見直しを検討する
