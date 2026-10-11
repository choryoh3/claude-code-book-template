-- Up Migration
-- ユーザー（一般ユーザーと管理者の両方）と、ログイン維持用の refresh token。
-- 管理者は role = 'admin' のユーザーとして同じテーブルに持ち、認証エンドポイントだけを分ける（docs/adr/0004）。

-- 更新時に updated_at を自動で現在時刻にする共通の関数
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TYPE user_role AS ENUM ('user', 'admin');

CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle           text NOT NULL CHECK (handle ~ '^[A-Za-z0-9_]{3,15}$'),
  email            text NOT NULL,
  password_hash    text NOT NULL,
  display_name     text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 50),
  bio              text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 160),
  avatar_url       text,
  header_url       text,
  role             user_role NOT NULL DEFAULT 'user',
  is_suspended     boolean NOT NULL DEFAULT false,
  suspended_at     timestamptz,
  suspended_reason text,
  last_login_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ハンドルとメールは大文字小文字を区別せず一意にする（Alice と alice を別人にしない）
CREATE UNIQUE INDEX users_handle_lower_key ON users (lower(handle));
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));
-- 管理画面の一覧（状態・ロールの絞り込み + 登録日の新しい順）
CREATE INDEX users_role_suspended_created_idx ON users (role, is_suspended, created_at DESC);

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- refresh token は「ハッシュ」だけを保存する（DB が漏れても token が使われないように）
CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  user_agent  text,
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 「このユーザーの有効な token を全て失効する」（凍結・強制ログアウト）を速くする
CREATE INDEX refresh_tokens_active_user_idx ON refresh_tokens (user_id) WHERE revoked_at IS NULL;

-- Down Migration
DROP TABLE refresh_tokens;
DROP TABLE users;
DROP TYPE user_role;
DROP FUNCTION set_updated_at();
