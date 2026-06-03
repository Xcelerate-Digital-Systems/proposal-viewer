'use client';

import { useState } from 'react';
import type { FeedbackCommentReaction } from '@/lib/supabase';

const EMOJI_OPTIONS = ['👍', '❤️', '👀', '🔥', '✅', '❓'];

interface ReactionBarProps {
  commentId: string;
  reactions: FeedbackCommentReaction[];
  currentUserName: string;
  currentUserId?: string | null;
  onToggleReaction: (commentId: string, emoji: string) => Promise<void>;
}

export default function ReactionBar({
  commentId,
  reactions,
  currentUserName,
  currentUserId,
  onToggleReaction,
}: ReactionBarProps) {
  const [toggling, setToggling] = useState<string | null>(null);

  const grouped = reactions.reduce<Record<string, FeedbackCommentReaction[]>>((acc, r) => {
    (acc[r.emoji] ||= []).push(r);
    return acc;
  }, {});

  const hasReacted = (emoji: string) => {
    const group = grouped[emoji];
    if (!group) return false;
    return group.some(
      (r) =>
        (currentUserId && r.author_user_id === currentUserId) ||
        r.author_name === currentUserName
    );
  };

  const handleToggle = async (emoji: string) => {
    setToggling(emoji);
    try {
      await onToggleReaction(commentId, emoji);
    } finally {
      setToggling(null);
    }
  };

  const hasAnyReactions = Object.keys(grouped).length > 0;

  if (!hasAnyReactions) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {Object.entries(grouped).map(([emoji, group]) => {
        const active = hasReacted(emoji);
        return (
          <button
            key={emoji}
            onClick={() => handleToggle(emoji)}
            disabled={toggling === emoji}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-2xs border transition-colors ${
              active
                ? 'bg-teal/10 border-teal/30 text-teal'
                : 'bg-surface border-edge-strong text-dim hover:border-edge-hover'
            }`}
          >
            <span>{emoji}</span>
            <span className="font-medium">{group.length}</span>
          </button>
        );
      })}
    </div>
  );
}
