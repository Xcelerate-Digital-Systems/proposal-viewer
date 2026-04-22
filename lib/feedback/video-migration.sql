-- Video feedback: adds a video_url column on review_comments and a public-read
-- storage bucket (review-videos) for hosting the uploaded webm/mp4 clips.
-- Writes route through /api/review-comments/video-upload using the service
-- role; public reads are by URL only (no enumeration) because the bucket is
-- public but filenames are unguessable.
--
-- Apply via the Supabase SQL editor or:
--   psql "$DATABASE_URL" -f lib/feedback/video-migration.sql

ALTER TABLE review_comments
  ADD COLUMN IF NOT EXISTS video_url text;

COMMENT ON COLUMN review_comments.video_url IS
  'URL to a recorded video feedback clip (webm, max ~2 min). Stored in the review-videos bucket; playback is embedded in CommentThread.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-videos',
  'review-videos',
  true,
  104857600,
  ARRAY['video/webm', 'video/mp4', 'video/ogg']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
