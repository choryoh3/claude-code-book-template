-- Up Migration
-- DAU（1 日に利用したユーザー数）を数えるための日次の利用記録。
-- 1 ユーザー 1 日 1 行。認証済みのリクエストを受けたとき、その日の行が無ければ追加する（あれば何もしない）。

CREATE TABLE daily_active_users (
  active_date  date NOT NULL,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (active_date, user_id)
);

-- 管理画面のダッシュボード: 日ごとの件数を数える
--   SELECT active_date, count(*) FROM daily_active_users WHERE active_date >= $1 GROUP BY 1;
-- 主キーが (active_date, user_id) なので、日付の範囲検索と日ごとの集計がそのまま index で解ける

-- Down Migration
DROP TABLE daily_active_users;
