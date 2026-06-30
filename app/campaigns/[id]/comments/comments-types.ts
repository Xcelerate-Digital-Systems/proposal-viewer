/* ------------------------------------------------------------------ */
/*  Shared types for the comments page                                 */
/* ------------------------------------------------------------------ */

export type ReviewCompletion = {
  id: string;
  review_project_id: string;
  reviewer_name: string | null;
  reviewer_email: string | null;
  message: string | null;
  completed_at: string;
};

export type TeamMemberOption = { id: string; name: string; email: string };
