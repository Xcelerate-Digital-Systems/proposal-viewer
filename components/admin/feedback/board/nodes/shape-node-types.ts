import type { FeedbackBoardShape } from '@/lib/supabase';
import type { FunnelTab, FunnelRole } from '@/lib/supabase';

export interface ShapeNodeData extends Record<string, unknown> {
  shape: FeedbackBoardShape;
  readOnly?: boolean;
  onUpdateContent?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
  linkedFunnelId?: string | null;
  linkedTabId?: string | null;
  onNavigateTab?: (tabId: string) => void;
  tabs?: FunnelTab[];
  description?: string | null;
  /** Funnel board only — raw `funnel_board_shapes.message` jsonb. When the
   *  shape type supports a message and this carries content, the node shows a
   *  pill that opens the email/SMS preview. Feedback board never sets it. */
  message?: unknown;
  /** Public viewer has no FunnelBoardProvider — the resolved role is passed in
   *  directly there. Omitted on the admin board, which reads it from context. */
  role?: FunnelRole | null;
}
