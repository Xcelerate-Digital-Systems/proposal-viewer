'use client';

import { Facebook, BarChart3, Tag, MonitorPlay, Globe } from 'lucide-react';
import type { AccessPlatform, AccessGrantStatus } from '@/lib/client-access/types';
import { PLATFORM_LABELS } from '@/lib/client-access/types';
import PlatformStatusBadge from './PlatformStatusBadge';

const PLATFORM_ICONS: Record<AccessPlatform, typeof Facebook> = {
  meta: Facebook,
  google_ga4: BarChart3,
  google_gtm: Tag,
  google_ads: MonitorPlay,
  wordpress: Globe,
};

const PLATFORM_DESCRIPTIONS: Record<AccessPlatform, string> = {
  meta: 'Connect your Facebook & Instagram ad accounts',
  google_ga4: 'Grant access to your Google Analytics property',
  google_gtm: 'Grant access to your Google Tag Manager container',
  google_ads: 'Connect your Google Ads account',
  wordpress: 'Add the agency as an admin on your WordPress site',
};

interface PlatformCardProps {
  platform: AccessPlatform;
  status: AccessGrantStatus;
  accountName?: string | null;
  errorMessage?: string | null;
  accentColor: string;
  onConnect: (platform: AccessPlatform) => void;
}

export default function PlatformCard({
  platform,
  status,
  accountName,
  errorMessage,
  accentColor,
  onConnect,
}: PlatformCardProps) {
  const Icon = PLATFORM_ICONS[platform];
  const label = PLATFORM_LABELS[platform];
  const description = PLATFORM_DESCRIPTIONS[platform];
  const isConnectable = status === 'pending' || status === 'failed' || status === 'oauth_complete';
  const isComplete = status === 'granted' || status === 'self_reported';

  return (
    <div
      className="rounded-xl border p-5 transition-all"
      style={{
        borderColor: isComplete ? '#10b98130' : '#ffffff12',
        backgroundColor: isComplete ? '#10b98108' : '#ffffff06',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <Icon size={20} style={{ color: accentColor }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">{label}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            {accountName && (
              <p className="text-xs text-gray-300 mt-1 truncate">{accountName}</p>
            )}
            {errorMessage && status === 'failed' && (
              <p className="text-xs text-red-400 mt-1">{errorMessage}</p>
            )}
          </div>
        </div>
        <div className="flex-shrink-0">
          <PlatformStatusBadge status={status} />
        </div>
      </div>

      {isConnectable && (
        <button
          onClick={() => onConnect(platform)}
          className="mt-4 w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: accentColor }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          {status === 'failed' || status === 'oauth_complete' ? 'Retry Connection' : 'Connect'}
        </button>
      )}

      {status === 'request_sent' && (
        <div className="mt-3 p-3 rounded-lg text-xs text-yellow-300/80" style={{ backgroundColor: '#f59e0b10' }}>
          {platform === 'meta'
            ? 'Check your Meta Business Suite notifications to approve the access request.'
            : 'Check your Google Ads account to accept the pending link request.'}
        </div>
      )}
    </div>
  );
}
