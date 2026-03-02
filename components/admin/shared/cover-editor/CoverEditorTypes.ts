// components/admin/shared/cover-editor/CoverEditorTypes.ts

/* ------------------------------------------------------------------ */
/*  Entity type & config                                               */
/* ------------------------------------------------------------------ */

export type EntityType = 'proposal' | 'template' | 'document';

export interface EntityConfig {
  table: string;
  defaultButtonText: string;
  coverPrefix: string;
  fields: {
    subtitle: boolean;
    preparedBy: boolean;
    acceptButtonText: boolean;
    clientLogo: boolean;
    avatar: boolean;
  };
  labels: {
    subtitle: string;
    subtitleHint: string;
    subtitlePlaceholder: string;
    preparedByLabel: string;
    preparedByHint: string;
  };
}

export const configs: Record<EntityType, EntityConfig> = {
  proposal: {
    table: 'proposals',
    defaultButtonText: 'START READING PROPOSAL',
    coverPrefix: '',
    fields: { subtitle: true, preparedBy: true, acceptButtonText: true, clientLogo: true, avatar: true },
    labels: {
      subtitle: 'Subtitle',
      subtitleHint: '',
      subtitlePlaceholder: '',
      preparedByLabel: 'Prepared By',
      preparedByHint: 'Shown on the cover page below the subtitle',
    },
  },
  template: {
    table: 'proposal_templates',
    defaultButtonText: 'START READING PROPOSAL',
    coverPrefix: 'template-',
    fields: { subtitle: true, preparedBy: true, acceptButtonText: false, clientLogo: true, avatar: true },
    labels: {
      subtitle: 'Default Subtitle',
      subtitleHint: 'This will be the default subtitle when creating proposals from this template. Can be overridden per proposal.',
      subtitlePlaceholder: 'Prepared for [Client Name]',
      preparedByLabel: 'Default Prepared By',
      preparedByHint: 'Shown on the cover page. Can be overridden per proposal.',
    },
  },
  document: {
    table: 'documents',
    defaultButtonText: 'START READING',
    coverPrefix: '',
    fields: { subtitle: true, preparedBy: false, acceptButtonText: false, clientLogo: false, avatar: false },
    labels: {
      subtitle: 'Subtitle',
      subtitleHint: 'Displayed below the document title',
      subtitlePlaceholder: 'e.g. Company Capabilities Overview',
      preparedByLabel: '',
      preparedByHint: '',
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Entity interface                                                   */
/* ------------------------------------------------------------------ */

export interface CoverEditorEntity {
  id: string;
  company_id: string;
  title?: string;
  name?: string;
  client_name?: string;
  description?: string | null;
  created_by_name?: string | null;
  cover_enabled: boolean;
  cover_image_path: string | null;
  cover_subtitle: string | null;
  cover_button_text: string | null;
  accept_button_text?: string | null;
  prepared_by?: string | null;
  prepared_by_member_id?: string | null;
  cover_bg_style: string | null;
  cover_bg_color_1: string | null;
  cover_bg_color_2: string | null;
  cover_gradient_type: string | null;
  cover_gradient_angle: number | null;
  cover_overlay_opacity: number | null;
  cover_text_color: string | null;
  cover_subtitle_color: string | null;
  cover_button_bg: string | null;
  cover_button_text_color: string | null;
  cover_client_logo_path?: string | null;
  cover_avatar_path?: string | null;
  cover_date?: string | null;
  cover_show_client_logo?: boolean;
  cover_show_avatar?: boolean;
  cover_show_date?: boolean;
  cover_show_prepared_by?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Resolved member (for prepared-by preview)                          */
/* ------------------------------------------------------------------ */

export interface ResolvedMember {
  name: string;
  avatar_url: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildGradient(type: string, angle: number, color1: string, color2: string): string {
  switch (type) {
    case 'radial':
      return `radial-gradient(circle, ${color1}, ${color2})`;
    case 'conic':
      return `conic-gradient(from ${angle}deg, ${color1}, ${color2})`;
    default:
      return `linear-gradient(${angle}deg, ${color1}, ${color2})`;
  }
}