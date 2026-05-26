// lib/types/swipe-files.ts

export type SwipeMediaType = 'image' | 'video';
export type SwipeMediaSource = 'upload' | 'external';

export type SwipeType = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  share_token: string;
  public_share_enabled: boolean;
  /**
   * Additional company_ids this folder is visible/writable to.
   * The owning company_id retains exclusive control over folder metadata
   * (rename, delete, share list). Partners may add/edit/delete files inside.
   */
  shared_with_company_ids: string[];
  created_at: string;
  updated_at: string;
};

export type SwipeFile = {
  id: string;
  company_id: string;
  type_id: string;
  title: string;
  notes: string | null;
  headline: string | null;
  primary_text: string | null;
  description: string | null;
  cta: string | null;
  tags: string[];
  media_type: SwipeMediaType | null;
  media_url: string | null;
  media_source: SwipeMediaSource | null;
  thumbnail_url: string | null;
  source_url: string | null;
  brand: string | null;
  share_token: string;
  public_share_enabled: boolean;
  has_been_shared: boolean;
  sort_order: number;
  transcription: string | null;
  ai_prompt: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SwipeTypeWithCount = SwipeType & {
  file_count: number;
};

// Public viewer payloads
export type PublicSwipeFilePayload = {
  mode: 'file';
  file: SwipeFile;
  type: Pick<SwipeType, 'id' | 'name'> | null;
};

export type PublicSwipeTypePayload = {
  mode: 'type';
  type: SwipeType;
  files: SwipeFile[];
};

export type PublicSwipePayload = PublicSwipeFilePayload | PublicSwipeTypePayload;
