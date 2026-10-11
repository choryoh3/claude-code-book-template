-- Up Migration
-- 通報（ユーザーが送り、管理者が処理する）と、管理者操作の監査ログ。

CREATE TYPE report_target_type AS ENUM ('post', 'user');
CREATE TYPE report_reason AS ENUM ('spam', 'harassment', 'inappropriate', 'other');
-- 未対応 / 対応中 / 完了
CREATE TYPE report_status AS ENUM ('open', 'in_progress', 'resolved');

CREATE TABLE reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  target_type     report_target_type NOT NULL,
  target_post_id  uuid REFERENCES posts (id) ON DELETE CASCADE,
  target_user_id  uuid REFERENCES users (id) ON DELETE CASCADE,
  reason          report_reason NOT NULL,
  detail          text NOT NULL DEFAULT '' CHECK (char_length(detail) <= 500),
  status          report_status NOT NULL DEFAULT 'open',
  admin_note      text NOT NULL DEFAULT '' CHECK (char_length(admin_note) <= 1000),
  handled_by      uuid REFERENCES users (id) ON DELETE SET NULL,
  handled_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- 対象は「投稿」か「ユーザー」のどちらか一方だけ、種類と列が対応していること
  CONSTRAINT reports_single_target CHECK (
    (target_type = 'post' AND target_post_id IS NOT NULL AND target_user_id IS NULL) OR
    (target_type = 'user' AND target_user_id IS NOT NULL AND target_post_id IS NULL)
  )
);

-- 同じ人が同じ対象を重複して通報できないようにする（画面の「すでに通報済みです」）
CREATE UNIQUE INDEX reports_unique_post_idx ON reports (reporter_id, target_post_id) WHERE target_post_id IS NOT NULL;
CREATE UNIQUE INDEX reports_unique_user_idx ON reports (reporter_id, target_user_id) WHERE target_user_id IS NOT NULL;
-- 管理画面の通報一覧（ステータス別に新しい順）
CREATE INDEX reports_status_created_idx ON reports (status, created_at DESC);
-- 対象側から見た通報（ユーザー詳細・投稿一覧の通報数）
CREATE INDEX reports_target_post_idx ON reports (target_post_id) WHERE target_post_id IS NOT NULL;
CREATE INDEX reports_target_user_idx ON reports (target_user_id) WHERE target_user_id IS NOT NULL;

CREATE TRIGGER reports_set_updated_at BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TYPE audit_action AS ENUM (
  'user_suspend', 'user_unsuspend', 'force_logout', 'role_change',
  'post_hide', 'post_unhide', 'post_delete', 'report_update'
);

CREATE TABLE audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 管理者のアカウントを消しても記録は残す必要があるため、CASCADE ではなく RESTRICT
  admin_id     uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  action       audit_action NOT NULL,
  target_type  text NOT NULL,
  target_id    uuid,
  -- 変更前後・理由など。パスワードやトークンなどの秘密値は入れない（.claude/rules/admin-security.md）
  detail       jsonb NOT NULL DEFAULT '{}',
  ip           inet,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 監査ログ画面の絞り込み（期間 / 操作者 / 操作種別）
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC, id DESC);
CREATE INDEX audit_logs_admin_created_idx ON audit_logs (admin_id, created_at DESC);
CREATE INDEX audit_logs_action_created_idx ON audit_logs (action, created_at DESC);

-- 監査ログは「変更も削除もできない」。アプリのバグや不正があっても改ざんされないよう DB 側で禁止する
CREATE FUNCTION forbid_audit_log_modification() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs は変更・削除できません';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_modification();

-- Down Migration
DROP TRIGGER audit_logs_immutable ON audit_logs;
DROP FUNCTION forbid_audit_log_modification();
DROP TABLE audit_logs;
DROP TYPE audit_action;
DROP TABLE reports;
DROP TYPE report_status;
DROP TYPE report_reason;
DROP TYPE report_target_type;
