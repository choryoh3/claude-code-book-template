Windows で GitHub CLI (gh) を使う方法

1. インストール

次のいずれかで入れます。

# winget(Windows 11 に標準搭載。おすすめ)

winget install --id GitHub.

# Scoop

scoop install gh

# Chocolatey

choco install gh

公式サイト(https://cli.github.com/)からインストーラ(.msi)をダウンロードすることもできます。

インストール後はターミナルを開き直してください。PATH が反映されます。

gh --version

2. ログイン(認証)

gh auth login

対話形式で次のように選びます。

1. GitHub.com を選択
2. プロトコルは HTTPS を選
3. 「Authenticate Git with your GitHub credentials?」は Yes
4. Login with a web browserコードをブラウザに入力

確認は次のコマンドです。

gh auth status

3. よく使うコマンド

# リポジトリ

gh repo clone owner/repo # クローン
gh repo create my-repo --pu
gh repo view --web # ブラウザで開く

# Issue

gh issue list
gh issue create --title "タイトル" --body "本文"
gh issue view 12

# プルリクエスト

gh pr create --title "タイトル" --body "説明"
gh pr list
gh pr checkout 34
gh pr merge 34

# GitHub Actions

gh run list
gh run watch

4. 補足

- PowerShell / コマンドプロ きます。
- 複数行の --body は、PowerShell ではヒアストリングを使うと楽です。--body-file ファイル名 で渡す方法もあります。
- 会社の GitHub Enterprise を使う場合は gh auth login --hostname your.host.com を実行します。
- コマンド補完を使うには、gOut-String |Invoke-Expression を $PROFILE に追記します。
- 困ったときは gh help や g さい。

このリポジトリでは .github/ リモートリポジトリの作成やPR 作成まで進めたい場合は、お手伝いします。

# Claude Code 機能 2つの軸で整理する

- 軸１ いつ読み込まれるか
  ・常時読み込み CLAUDE.md
  ・条件付き読み込み .claude/rules/
  ・必要な時だけ（Claude判断）読み込み Skills
  ・手動で呼び出し読み込み カスタムコマンド
  - 軸２ 誰が動くか
    ・Claude本体/別プロセス（サブエージェント、Hooks=シェル）/外部サービス（MCP）
