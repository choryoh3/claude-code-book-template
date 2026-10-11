-- Up Migration
-- 投稿（リプライ・引用を含む）とハッシュタグ。
-- 検索（部分一致）用に pg_trgm を使う。日本語は単語区切りがないため、全文検索よりトライグラムが扱いやすい。

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 投稿の状態: 表示中 / 管理者が非表示 / 削除済み（行は残す。リプライや通報の参照を壊さないため）
CREATE TYPE post_status AS ENUM ('visible', 'hidden', 'deleted');

CREATE TABLE posts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content            text NOT NULL DEFAULT '' CHECK (char_length(content) <= 280),
  media_urls         text[] NOT NULL DEFAULT '{}' CHECK (cardinality(media_urls) <= 4),
  reply_to_id        uuid REFERENCES posts (id) ON DELETE SET NULL,
  quote_of_id        uuid REFERENCES posts (id) ON DELETE SET NULL,
  status             post_status NOT NULL DEFAULT 'visible',
  status_changed_at  timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- 本文も画像も無い投稿は作れない
  CONSTRAINT posts_has_body CHECK (char_length(content) >= 1 OR cardinality(media_urls) >= 1),
  -- リプライであり、かつ引用でもある投稿は作れない
  CONSTRAINT posts_reply_xor_quote CHECK (reply_to_id IS NULL OR quote_of_id IS NULL)
);

-- プロフィールの「投稿」タブ・フォロー中タイムライン（投稿者を絞って新しい順）
CREATE INDEX posts_author_created_idx ON posts (author_id, created_at DESC, id DESC);
-- 「おすすめ」「検索」など全体を新しい順に見る（表示中の投稿だけ）
CREATE INDEX posts_visible_created_idx ON posts (created_at DESC, id DESC) WHERE status = 'visible';
-- 投稿詳細のリプライ一覧
CREATE INDEX posts_reply_to_idx ON posts (reply_to_id, created_at) WHERE reply_to_id IS NOT NULL;
-- 引用の逆引き（この投稿を引用した投稿）
CREATE INDEX posts_quote_of_idx ON posts (quote_of_id) WHERE quote_of_id IS NOT NULL;
-- 本文の部分一致検索（ILIKE '%キーワード%'）
CREATE INDEX posts_content_trgm_idx ON posts USING gin (content gin_trgm_ops);

CREATE TRIGGER posts_set_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ユーザー検索（ハンドル・表示名の部分一致）
CREATE INDEX users_handle_trgm_idx ON users USING gin (handle gin_trgm_ops);
CREATE INDEX users_display_name_trgm_idx ON users USING gin (display_name gin_trgm_ops);

-- ハッシュタグ。tag は「#」を除いた小文字で保存する（#Vue と #vue を同じタグにする）
CREATE TABLE hashtags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag         text NOT NULL CHECK (tag = lower(tag) AND char_length(tag) BETWEEN 1 AND 100),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX hashtags_tag_key ON hashtags (tag);
CREATE INDEX hashtags_tag_trgm_idx ON hashtags USING gin (tag gin_trgm_ops);

CREATE TABLE post_hashtags (
  post_id     uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  hashtag_id  uuid NOT NULL REFERENCES hashtags (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, hashtag_id)
);
-- タグ検索とトレンド集計（このタグの投稿を新しい順 / 直近 N 時間の件数）
CREATE INDEX post_hashtags_hashtag_created_idx ON post_hashtags (hashtag_id, created_at DESC);

-- Down Migration
DROP TABLE post_hashtags;
DROP TABLE hashtags;
DROP INDEX users_display_name_trgm_idx;
DROP INDEX users_handle_trgm_idx;
DROP TABLE posts;
DROP TYPE post_status;
