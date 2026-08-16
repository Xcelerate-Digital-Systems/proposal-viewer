'use client';

import { useState } from 'react';
import { ExternalLink, Check, Globe } from 'lucide-react';
import type { AccessGrantStatus } from '@/lib/client-access/types';
import PlatformStatusBadge from './PlatformStatusBadge';

interface WordPressInstructionsProps {
  status: AccessGrantStatus;
  agencyEmail: string | null;
  accentColor: string;
  token: string;
  onConfirmed: () => void;
}

export default function WordPressInstructions({
  status,
  agencyEmail,
  accentColor,
  token,
  onConfirmed,
}: WordPressInstructionsProps) {
  const [wpUrl, setWpUrl] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isComplete = status === 'self_reported' || status === 'granted';

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/access/${token}/wordpress/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wp_site_url: wpUrl || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Something went wrong');
        return;
      }
      onConfirmed();
    } catch {
      setError('Unable to confirm. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const adminUrl = wpUrl
    ? `${wpUrl.replace(/\/$/, '')}/wp-admin/user-new.php`
    : null;

  return (
    <div
      className="rounded-xl border p-5 transition-all"
      style={{
        borderColor: isComplete ? '#10b98130' : '#ffffff12',
        backgroundColor: isComplete ? '#10b98108' : '#ffffff06',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <Globe size={20} style={{ color: accentColor }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">WordPress</h3>
            <p className="text-xs text-gray-400 mt-0.5">Add the agency as an admin on your site</p>
          </div>
        </div>
        <PlatformStatusBadge status={status} />
      </div>

      {!isComplete && (
        <div className="mt-4 space-y-3">
          {/* Step 1: Enter URL */}
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Your WordPress admin URL</label>
            <input
              type="url"
              value={wpUrl}
              onChange={(e) => setWpUrl(e.target.value)}
              placeholder="https://yoursite.com"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
            />
          </div>

          {/* Step 2: Instructions */}
          {wpUrl && (
            <div className="rounded-lg p-3 text-xs space-y-2" style={{ backgroundColor: '#ffffff08' }}>
              <p className="text-gray-300 font-medium">Follow these steps:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-gray-400">
                <li>
                  Click the button below to open your WordPress admin
                </li>
                <li>
                  Enter the agency email: <span className="text-white font-mono">{agencyEmail || 'check with your agency'}</span>
                </li>
                <li>Select the <span className="text-white">Administrator</span> role</li>
                <li>Click <span className="text-white">Add New User</span></li>
              </ol>

              <a
                href={adminUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                style={{ backgroundColor: accentColor }}
              >
                Open WordPress Admin <ExternalLink size={12} />
              </a>
            </div>
          )}

          {/* Step 3: Confirm */}
          {wpUrl && (
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: '#10b981' }}
            >
              <Check size={16} />
              {confirming ? 'Confirming…' : "I've completed this"}
            </button>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
