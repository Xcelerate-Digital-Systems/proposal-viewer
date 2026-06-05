import { Globe, Image as ImageIcon, Mail, Smartphone, Monitor, MessageSquare, FolderOpen } from 'lucide-react';
import type { FeedbackComment, CommentTask } from '@/lib/supabase';

/**
 * Comment row enriched with denormalised item info — used by the project-wide
 * feedback list and its detail modal. Matches the shape produced when joining
 * `review_comments` to its parent `review_items`.
 *
 * Project-level comments (review_item_id is null) use item_title = 'Campaign'
 * and item_type = 'campaign'.
 */
export type CommentWithItem = FeedbackComment & {
  item_title: string;
  item_type: string;
  item_url: string | null;
  reply_count: number;
  screenshot_url?: string | null;
  video_url?: string | null;
  annotation_data?: unknown;
  tasks?: CommentTask[];
};

/** Icon used in the row + sidebar to hint at the item's content type. */
export const TYPE_ICONS: Record<string, typeof Globe> = {
  webpage: Globe,
  image: ImageIcon,
  email: Mail,
  sms: Smartphone,
  ad: Monitor,
  campaign: FolderOpen,
};

export const FALLBACK_TYPE_ICON = MessageSquare;
