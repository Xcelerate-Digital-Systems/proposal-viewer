'use client';

/**
 * Round avatar used in CommentThread / ReplyItem / ResolvedSection.
 * Renders a team member's photo when we have one in the lookup, otherwise
 * falls back to the existing initial bubble. Keeps the colour scheme
 * consistent: teal for team users, violet for guests.
 */

import type { TeamMemberLookup } from '@/hooks/useTeamMemberLookup';

interface Props {
  authorName: string;
  authorUserId: string | null;
  isTeam: boolean;
  memberLookup?: TeamMemberLookup;
  /** Tailwind size classes — pass `w-8 h-8 text-[12px]` etc. */
  className?: string;
  /** Optional muted variant — used in ResolvedSection. */
  muted?: boolean;
}

export default function CommentAvatar({
  authorName,
  authorUserId,
  isTeam,
  memberLookup,
  className = 'w-8 h-8 text-[12px]',
  muted = false,
}: Props) {
  const url = authorUserId ? memberLookup?.[authorUserId]?.avatarUrl : null;

  const initialBg = muted
    ? 'bg-gray-200 text-gray-500'
    : isTeam
      ? 'bg-teal/10 text-teal'
      : 'bg-violet-100 text-violet-700';

  if (url) {
    return (
      <img
        src={url}
        alt={authorName}
        className={`${className} rounded-full object-cover shrink-0`}
        draggable={false}
      />
    );
  }

  return (
    <div
      className={`${className} rounded-full flex items-center justify-center shrink-0 font-semibold ${initialBg}`}
    >
      {authorName.charAt(0).toUpperCase()}
    </div>
  );
}
