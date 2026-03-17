// components/admin/ads/QuickCreateModal.tsx
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import CustomSelect from './CustomSelect';
import { AD_ITERATION_TYPES, AD_MEDIA_TYPES } from '@/lib/ad-tracker/constants';

type Props = {
  onClose: () => void;
  onCreate: (data: Record<string, unknown>) => Promise<{ error?: string }>;
};

const iterationOptions = AD_ITERATION_TYPES.map((t) => ({ value: t.value, label: t.label }));
const mediaOptions = AD_MEDIA_TYPES.map((t) => ({ value: t.value, label: t.label }));

export default function QuickCreateModal({ onClose, onCreate }: Props) {
  const [adName, setAdName] = useState('');
  const [iterationType, setIterationType] = useState('new');
  const [mediaType, setMediaType] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adName.trim()) return;

    setSaving(true);
    setError(null);

    const result = await onCreate({
      ad_name: adName.trim(),
      status: 'draft',
      iteration_type: iterationType || null,
      media_type: mediaType || null,
    });

    if (result.error) {
      setError(result.error);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
          <h2 className="text-base font-semibold text-ink">New Creative</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-faint hover:text-muted hover:bg-surface"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-muted mb-1">Ad Name *</label>
            <input
              type="text"
              value={adName}
              onChange={(e) => setAdName(e.target.value)}
              placeholder="Use the naming convention"
              className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-[13px] text-ink placeholder-faint outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/30 transition-all"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-muted mb-1">Type</label>
              <CustomSelect
                value={iterationType}
                options={iterationOptions}
                onChange={setIterationType}
                placeholder="Select..."
                clearable={false}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-muted mb-1">Media</label>
              <CustomSelect
                value={mediaType}
                options={mediaOptions}
                onChange={setMediaType}
                placeholder="Select..."
              />
            </div>
          </div>

          {error && <p className="text-[13px] text-red-600">{error}</p>}

          <p className="text-[11px] text-faint">You can fill in all other details inline in the table after creating.</p>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-[13px] font-medium text-muted bg-surface rounded-[10px] hover:bg-edge transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!adName.trim() || saving}
              className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-white bg-teal hover:bg-teal-hover rounded-[10px] transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
