# 0004. 認証は JWT（access はメモリ、refresh は httpOnly Cookie）

- ステータス: 採用
- 日付: 2026-10-11

## 背景

メール + パスワードによるログインが必要。管理者と一般ユーザーは別ロール・別の認証経路にする。SPA（Vue）と API サーバーが別ポートで動く。

## 検討した選択肢

1. **サーバーセッション（Cookie にセッション ID）** — 失効が簡単。ただしサーバーに状態を持つ必要があり、複数サーバーや Socket.IO との連携で工夫が要る
2. **JWT を localStorage に保存** — 実装は簡単。ただし XSS で盗まれやすい
3. **短寿命の access JWT（メモリ）+ 長寿命の refresh トークン（httpOnly Cookie）** — access が盗まれても短時間で失効し、refresh は JavaScript から読めない

## 決定

**選択肢 3** を採用する。

- access token: 有効期限 15 分程度。クライアントの **メモリ（Pinia）** にだけ置く。ページを再読み込みしたら refresh で取り直す
- refresh token: httpOnly + Secure(本番) + SameSite の Cookie。**DB にハッシュで保存** し、ローテーション（使うたびに新しいものに交換）。凍結・強制ログアウト時は失効させる
- パスワードは bcrypt でハッシュ化する
- ロールは `user` / `admin`。**管理者は別のエンドポイント・別の JWT シークレット** を使い、一般ユーザーのトークンで admin API を叩けないようにする

## 結果

- 良い点: XSS・トークン漏洩への耐性が高い。凍結の即時反映ができる（refresh の失効）
- 注意点: CORS と Cookie の設定（`credentials`）を正しく行う。401 時は refresh を 1 回だけ試す（無限ループ防止）
