-- Up Migration
-- フォロー関係と、投稿への反応（いいね・リポスト・ブックマーク）。
-- どれも「誰が・誰に/何に」を主キーにして、同じ操作の重複を DB の制約で防ぐ。

CREATE TABLE follows (
  follower_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  followee_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT follows_not_self CHECK (follower_id <> followee_id)
);
-- フォロワー一覧（このユーザーをフォローしている人を新しい順）
CREATE INDEX follows_followee_created_idx ON follows (followee_id, created_at DESC);
-- フォロー中一覧は主キー（follower_id, followee_id）で足りるが、新しい順に並べるため別に持つ
CREATE INDEX follows_follower_created_idx ON follows (follower_id, created_at DESC);

CREATE TABLE likes (
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  post_id     uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
-- 投稿ごとのいいね数・いいねした人の一覧
CREATE INDEX likes_post_idx ON likes (post_id);
-- プロフィールの「いいね」タブ（このユーザーがいいねした投稿を新しい順）
CREATE INDEX likes_user_created_idx ON likes (user_id, created_at DESC);

CREATE TABLE reposts (
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  post_id     uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX reposts_post_idx ON reposts (post_id);
-- タイムラインにリポストを混ぜるため、ユーザーごとに新しい順で引けるようにする
CREATE INDEX reposts_user_created_idx ON reposts (user_id, created_at DESC);

CREATE TABLE bookmarks (
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  post_id     uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
-- ブックマーク一覧（新しく保存した順）
CREATE INDEX bookmarks_user_created_idx ON bookmarks (user_id, created_at DESC);

-- Down Migration
DROP TABLE bookmarks;
DROP TABLE reposts;
DROP TABLE likes;
DROP TABLE follows;
