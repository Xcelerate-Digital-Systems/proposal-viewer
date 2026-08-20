import type { FeedbackBoardShape } from '@/lib/supabase';
import type { FunnelTab } from '@/lib/supabase';

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
}
