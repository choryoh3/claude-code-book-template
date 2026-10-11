import antfu from '@antfu/eslint-config'

export default antfu(
  {
    // フォーマットは Prettier に任せるため stylistic は無効化
    stylistic: false,
    typescript: true,
    vue: true,
    markdown: false,
    ignores: [
      '**/dist',
      '**/coverage',
      '**/.turbo',
      'packages/db/migrations',
      'packages/db/src/generated',
      '.claude',
      'docs/architecture',
      'playwright-report',
      'test-results',
    ],
  },
  {
    // 理由: .mjs（Node 用の小さなスクリプト）で、使っている変数を
    // 「型としてしか使われていない」と誤検知する不具合があるため、この規則だけ無効にする。
    // 未使用変数は TypeScript 側の検査（pnpm typecheck）で .ts を守る。
    // 詳細: docs/troubleshooting.md「ESLint が .mjs で誤検知する」
    name: 'xclone/mjs-scripts',
    files: ['**/*.mjs'],
    rules: {
      'unused-imports/no-unused-vars': 'off',
      // Node 22 の ESM ではトップレベル await が使え、スクリプトを読みやすくできる
      'antfu/no-top-level-await': 'off',
      // CLI スクリプトは結果を console に出すのが仕事
      'no-console': 'off',
    },
  },
  {
    // 理由: packages/db はサーバーではなく「マイグレーション・seed などの CLI ツール」なので、
    // 進捗や結果を console に出すのが仕事。（サーバーのログは pino を使う: .claude/rules/observability.md）
    name: 'xclone/db-cli-tools',
    files: ['packages/db/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // 理由: .vue のテンプレートの見た目（改行・字下げ・自己終了タグ）は Prettier が整える。
    // ESLint の同じ種類の規則を有効にすると、保存のたびに互いに書き換え合う。さらに
    // 「タグの中身の前後に改行を足す」自動修正は、文字の前後に空白を生んで表示を変えてしまう
    // （改行をそのまま表示する本文 = whitespace-pre-wrap で、ハッシュタグの前後に空白が出た）ため、無効にする。
    name: 'xclone/vue-template-formatting',
    files: ['**/*.vue'],
    rules: {
      'vue/html-indent': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-closing-bracket-spacing': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/first-attribute-linebreak': 'off',
    },
  },
  {
    // 理由: package.json / tsconfig のキー順は「意味のまとまり」を優先したいので強制しない。
    // pnpm-workspace.yaml の設定強制も、学習コストに見合わないため使わない。
    name: 'xclone/config-files',
    rules: {
      'jsonc/sort-keys': 'off',
      'pnpm/yaml-enforce-settings': 'off',
      // 理由: 16 進数の大文字小文字は Prettier（小文字）と ESLint（大文字）が衝突し、
      // 保存のたびに互いに書き換えてしまうため。見た目の整形は Prettier に一本化する
      'unicorn/number-literal-case': 'off',
    },
  },
)
