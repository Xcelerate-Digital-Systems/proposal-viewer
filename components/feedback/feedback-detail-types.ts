import type { FeedbackProject, FeedbackItem, FeedbackComment, FeedbackStatus } from '@/lib/supabase';
import type {
  CommentTask,
  FeedbackCommentPriority,
} from '@/lib/types/feedback';
import type { VersionView } from '@/lib/feedback/versions';
import type { CompanyBranding } from '@/hooks/useProposal';

/* ─── Types ──────────────────────────────────────────────────────── */

export interface ReviewDetailViewProps {
  /** 'admin' = authenticated team member, 'client' = public token-based */
  mode: 'admin' | 'client';

  // ── Data ──
  project: FeedbackProject;
  items: FeedbackItem[];
  comments: FeedbackComment[];
  /** All project comments for sidebar badge counts (admin only — lightweight shape) */
  allProjectComments?: Pick<FeedbackComment, 'id' | 'review_item_id' | 'parent_comment_id' | 'resolved'>[];

  // ── Branding (client mode) ──
  branding?: CompanyBranding;

  // ── Initial selection ──
  /** Pre-select this item on mount */
  initialItemId?: string | null;
  /** Pre-set type filter (e.g. ?type=ad) */
  initialTypeFilter?: string | null;
  /** Show only a single item — no sidebar (individual item share) */
  singleItemOnly?: boolean;
  /** Hide the type filter bar in sidebar (e.g. when deep-linked from whiteboard) */
  hideFilterBar?: boolean;

  // ── Identity ──
  /** Admin: fixed author name for comments */
  authorName?: string;
  /** Client: guest name state */
  guestName?: string;
  /** Client: guest name setter */
  onGuestNameChange?: (name: string) => void;

  // ── Callbacks ──
  /** Submit a new comment */
  onSubmitComment: (reviewItemId: string, content: string, pinX?: number, pinY?: number, parentId?: string, annotationData?: unknown, screenshotUrl?: string, highlightData?: { text: string; start: number; end: number; elementPath: string }, priority?: FeedbackCommentPriority, attachments?: import('@/lib/supabase').FeedbackCommentAttachment[], videoUrl?: string | null) => Promise<void>;
  /** Resolve a comment (admin only) */
  onResolveComment?: (commentId: string) => Promise<void>;
  /** Unresolve a comment (admin only) */
  onUnresolveComment?: (commentId: string) => Promise<void>;
  /** Edit a comment's content (admin only) */
  onEditComment?: (commentId: string, content: string) => Promise<void>;
  /** Delete a comment and its replies (admin only) */
  onDeleteComment?: (commentId: string) => Promise<void>;
  /** Open task creation modal for a comment (admin only, internal) */
  onOpenTasks?: (commentId: string) => void;
  /** Inline quick-assign: create a task on a comment (admin only, internal) */
  onQuickAssign?: (commentId: string, memberId: string, instructions: string) => Promise<void>;
  /** Toggle task completion (admin only, internal) */
  onToggleTaskComplete?: (commentId: string, taskId: string, completed: boolean) => Promise<void>;
  /** Remove a task from a comment (admin only, internal) */
  onRemoveTask?: (commentId: string, taskId: string) => Promise<void>;
  /** Current user's team_member_id (for "Mark Complete" gate) */
  currentMemberId?: string | null;
  /** Open standalone task detail view */
  onOpenTaskDetail?: (commentId: string, task: CommentTask) => void;
  /** Called when selected item changes — admin uses this for router.push */
  onItemChange?: (itemId: string, typeFilter: string | null) => void;
  /** Called when type filter changes — admin uses this for URL sync */
  onFilterChange?: (type: string | null, firstItemId: string | null) => void;

  // ── Navigation ──
  /** Back button config — { label, onClick } */
  backAction?: { label: string; onClick: () => void };
  /** Share token for content loading (e.g. signed URLs) */
  shareToken?: string;

  /**
   * When true, click-to-pin + automatic text-highlight capture are disabled so
   * the reviewer can interact with the underlying content (click links, scroll
   * inside frames, select text without leaving a comment). Drawing tools still
   * work if the user explicitly picks one.
   */
  browseMode?: boolean;

  // ── Admin extras ──
  /** Render function for header-right actions (share button, external link, etc.) */
  renderHeaderActions?: (currentItem: FeedbackItem | null) => React.ReactNode;

  // ── Attachments ──
  /** Company ID — needed for attachment uploads */
  companyId?: string;

  // ── Comments updated externally (e.g. after submit in parent) ──
  /** Updated comments array — when parent manages comment state */
  onCommentsUpdate?: (comments: FeedbackComment[]) => void;

  // ── Versions (per selected item) ──
  /** Ordered list of versions for the currently-selected item, v1 first. */
  versions?: VersionView[];
  /** review_item_versions.id of the active version, or null for v1. */
  activeVersionId?: string | null;
  /** Called when the user picks a different version. */
  onVersionChange?: (versionId: string | null) => void;
  /** When provided, the version picker shows a "+" button that calls this. */
  onAddVersion?: () => void;
  /** Open the editor for an existing version (admin only). */
  onEditVersion?: (versionId: string | null) => void;

  // ── Client status update ──
  /** Client can change status (approve / request revision / reject). When
   *  provided, a status picker appears in the header. */
  onUpdateItemStatus?: (itemId: string, status: FeedbackStatus) => Promise<void> | void;

  // ── Public review chrome (client mode only) ──
  /** When provided, renders Comment/Browse pill, reviewer avatar, and Finish
   *  reviewing button on the right of the header. */
  reviewMode?: 'comment' | 'browse';
  onReviewModeChange?: (mode: 'comment' | 'browse') => void;
  reviewerName?: string;
  reviewerAvatarUrl?: string | null;
  reviewerEmail?: string;
  reviewSubmitted?: boolean;
  onReviewSubmitted?: () => void;
}
