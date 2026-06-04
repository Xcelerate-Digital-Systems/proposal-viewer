'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface StatusSegment {
  key: string;
  label: string;
  hex: string;
  count: number;
}

interface PipelineSummaryProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  href: string;
  linkLabel: string;
  segments: StatusSegment[];
  total: number;
}

export default function PipelineSummary({
  icon: Icon,
  title,
  href,
  linkLabel,
  segments,
  total,
}: PipelineSummaryProps) {
  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center">
            <Icon size={14} className="text-muted" />
          </div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <span className="text-detail text-muted">{total}</span>
        </div>
        <Link
          href={href}
          className="text-xs font-medium text-primary hover:text-primary-hover inline-flex items-center gap-1"
        >
          {linkLabel} <ArrowRight size={12} />
        </Link>
      </div>

      {total === 0 ? (
        <div className="px-5 pb-4">
          <p className="text-caption text-muted">No items yet.</p>
        </div>
      ) : (
        <div className="px-5 pb-4 space-y-3">
          {/* Status distribution bar */}
          <div
            className="flex h-2 rounded-full overflow-hidden bg-edge"
            role="img"
            aria-label={segments.filter(s => s.count > 0).map(s => `${s.label}: ${s.count}`).join(', ')}
          >
            {segments
              .filter((s) => s.count > 0)
              .map((s) => (
                <div
                  key={s.key}
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${(s.count / total) * 100}%`,
                    backgroundColor: s.hex,
                  }}
                  title={`${s.label}: ${s.count}`}
                />
              ))}
          </div>

          {/* Status legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {segments
              .filter((s) => s.count > 0)
              .map((s) => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.hex }}
                  />
                  <span className="text-detail text-muted">
                    {s.label} <span className="text-ink font-medium">{s.count}</span>
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
