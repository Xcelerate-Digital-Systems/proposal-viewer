import type { LucideIcon } from 'lucide-react';
import {
  MessageSquare, CornerDownRight, CheckCheck, Layers, Package,
} from 'lucide-react';

export type Member = {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string;
  role: string | null;
};

export type Assignee = {
  team_member_id: string;
  notify_comment: boolean;
  notify_reply: boolean;
  notify_resolve: boolean;
  notify_status: boolean;
  notify_new_version: boolean;
  stages: string[];
};

export type GuestPrefs = {
  notify_comment: boolean;
  notify_reply: boolean;
  notify_resolve: boolean;
  notify_status: boolean;
  notify_new_version: boolean;
};

export type Guest = {
  email: string;
  name: string;
  removed: boolean;
  prefs: GuestPrefs;
  stages: string[];
};

export type PrefKey =
  | 'notify_comment'
  | 'notify_reply'
  | 'notify_resolve'
  | 'notify_status'
  | 'notify_new_version';

export const PREF_DEFS: { key: PrefKey; label: string; icon: LucideIcon }[] = [
  { key: 'notify_comment', label: 'Comments', icon: MessageSquare },
  { key: 'notify_reply', label: 'Replies', icon: CornerDownRight },
  { key: 'notify_resolve', label: 'Resolved', icon: CheckCheck },
  { key: 'notify_status', label: 'Status changes', icon: Layers },
  { key: 'notify_new_version', label: 'New versions', icon: Package },
];

export const ALL_PREF_KEYS = PREF_DEFS.map((p) => p.key);

/* ── Avatar helpers ───────────────────────────────────────────────────── */

export const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-violet-500', 'bg-teal-500', 'bg-indigo-500', 'bg-orange-500',
];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function avatarInitials(name: string, email: string): string {
  const source = (name || email || '?').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
