'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function GeneralCommentComposer({ onSubmit }: { onSubmit: (content: string) => Promise<boolean> }) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isEmpty = !value.trim();

  const handleSubmit = async () => {
    if (isEmpty || submitting) return;
    setSubmitting(true);
    const ok = await onSubmit(value);
    setSubmitting(false);
    if (ok) setValue('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden px-5 py-4">
      <p className="text-xs font-medium text-dim mb-2">Add a general comment</p>
      <div className="flex items-start gap-3">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Leave feedback about this campaign…"
          rows={2}
          className="flex-1 text-sm rounded-lg border border-edge-strong px-3 py-2.5 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-none"
        />
        <Button
          size="sm"
          loading={submitting}
          disabled={isEmpty || submitting}
          leftIcon={Send}
          onClick={handleSubmit}
        >
          Post
        </Button>
      </div>
    </div>
  );
}
