-- Add due_date column to review_projects for project-level deadlines.
-- Nullable — most projects won't have one initially.
ALTER TABLE public.review_projects
  ADD COLUMN IF NOT EXISTS due_date date;

-- Optional index for future cron-based queries (e.g. "overdue projects").
CREATE INDEX IF NOT EXISTS idx_review_projects_due_date
  ON public.review_projects (due_date)
  WHERE due_date IS NOT NULL;
