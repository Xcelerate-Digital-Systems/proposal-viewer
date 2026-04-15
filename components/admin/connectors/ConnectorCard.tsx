// components/admin/connectors/ConnectorCard.tsx
//
// Presentational card for a single data-source connector (e.g. Facebook Ads,
// GoHighLevel). Status + CTA logic lives in the parent so this component stays
// dumb and re-styling is in one place.

import { ReactNode } from 'react';

export type ConnectorStatus = 'connected' | 'disconnected' | 'needs_reauth' | 'coming_soon';

interface Props {
  icon: ReactNode;         // anything renderable (lucide icon, inline SVG, etc.)
  iconBg: string;          // tailwind class for the rounded icon tile background
  name: string;
  description: string;
  status: ConnectorStatus;
  statusDetail?: string;   // optional secondary line under the description
  primaryAction?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

function StatusPill({ status }: { status: ConnectorStatus }) {
  const config = {
    connected:    { label: 'Connected',     cls: 'bg-teal-tint text-teal' },
    needs_reauth: { label: 'Needs reauth',  cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    disconnected: { label: 'Not connected', cls: 'bg-gray-100 text-faint' },
    coming_soon:  { label: 'Coming soon',   cls: 'bg-gray-100 text-faint' },
  }[status];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full ${config.cls}`}>
      {config.label}
    </span>
  );
}

export default function ConnectorCard({
  icon,
  iconBg,
  name,
  description,
  status,
  statusDetail,
  primaryAction,
  secondaryAction,
}: Props) {
  return (
    <div className="flex flex-col bg-white border border-line rounded-2xl p-5 hover:border-line/80 transition-colors">
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-semibold text-ink">{name}</h3>
            <StatusPill status={status} />
          </div>
          <p className="text-xs text-faint mt-1 leading-relaxed">{description}</p>
          {statusDetail && (
            <p className="text-xs text-muted mt-2 truncate">{statusDetail}</p>
          )}
        </div>
      </div>

      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-line">
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled || primaryAction.loading}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                status === 'connected'
                  ? 'text-faint hover:text-ink border border-line hover:bg-surface'
                  : 'bg-teal text-white hover:bg-teal/90'
              }`}
            >
              {primaryAction.loading ? 'Working…' : primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-3.5 py-2 text-xs font-medium text-faint hover:text-ink border border-line rounded-lg hover:bg-surface transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
