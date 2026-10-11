-- Up Migration
-- トレンドの集計（直近 7 日に使われたタグを数える）を速くするためのインデックス。
--   SELECT ... FROM post_hashtags WHERE created_at > now() - interval '7 days' GROUP BY hashtag_id
-- 既存の post_hashtags_hashtag_created_idx は hashtag_id が先頭なので、「期間だけ」の条件では使えない
-- （Phase 3 のコードレビューで指摘。件数が増えると全件を読むことになる）。
CREATE INDEX post_hashtags_created_idx ON post_hashtags (created_at DESC);

-- Down Migration
DROP INDEX post_hashtags_created_idx;
