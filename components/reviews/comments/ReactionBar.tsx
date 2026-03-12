// components/reviews/comments/ReactionBar.tsx
'use client';

import { useState } from 'react';
import { SmilePlus } from 'lucide-react';
import type { ReviewCommentReaction } from '@/lib/supabase';

const EMOJI_OPTIONS = ['👍', '❤️', '👀', '🔥', '✅', '❓'];

interface ReactionBarProps {
  commentId: string;
  reactions: ReviewCommentReaction[];
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
  const [showPicker, setShowPicker] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  // Group reactions by emoji
  const grouped = reactions.reduce<Record<string, ReviewCommentReaction[]>>((acc, r) => {
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
      setShowPicker(false);
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Existing reaction chips */}
      {Object.entries(grouped).map(([emoji, group]) => {
        const active = hasReacted(emoji);
        return (
          <button
            key={emoji}
            onClick={() => handleToggle(emoji)}
            disabled={toggling === emoji}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${
              active
                ? 'bg-teal/10 border-teal/30 text-teal'
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <span>{emoji}</span>
            <span className="font-medium">{group.length}</span>
          </button>
        );
      })}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="w-5 h-5 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <SmilePlus size={10} />
        </button>

        {showPicker && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
            {/* Picker */}
            <div className="absolute bottom-full left-0 mb-1 z-50 flex gap-0.5 bg-white border border-gray-200 rounded-lg shadow-lg px-1.5 py-1">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleToggle(emoji)}
                  disabled={toggling !== null}
                  className={`w-6 h-6 rounded hover:bg-gray-100 flex items-center justify-center text-sm transition-colors ${
                    hasReacted(emoji) ? 'bg-teal/10' : ''
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
