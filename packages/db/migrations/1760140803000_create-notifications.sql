-- Up Migration
-- 通知。いいね・リポスト・フォロー・リプライ・メンション・引用の 6 種類。
-- 通知は「実行した人（actor）」と「受け取る人（recipient）」を持つ。Socket.IO で送る内容もここが元になる。

CREATE TYPE notification_type AS ENUM ('like', 'repost', 'follow', 'reply', 'mention', 'quote');

CREATE TABLE notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  actor_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type          notification_type NOT NULL,
  post_id       uuid REFERENCES posts (id) ON DELETE CASCADE,
  is_read       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- 自分の操作では通知しない
  CONSTRAINT notifications_not_self CHECK (recipient_id <> actor_id),
  -- フォロー以外は対象の投稿が必要
  CONSTRAINT notifications_post_required CHECK (type = 'follow' OR post_id IS NOT NULL)
);

-- 通知一覧（自分宛を新しい順）
CREATE INDEX notifications_recipient_created_idx ON notifications (recipient_id, created_at DESC, id DESC);
-- 未読バッジの件数（未読だけを対象にした小さなインデックス）
CREATE INDEX notifications_unread_idx ON notifications (recipient_id) WHERE is_read = false;

-- Down Migration
DROP TABLE notifications;
DROP TYPE notification_type;
