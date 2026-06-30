// app/templates/PackageTemplatesView.tsx
'use client';

import { Pencil, Trash2, Package } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import NoResults from '@/components/ui/NoResults';
import type { PackageTemplateRow } from './templates-types';

export default function PackageTemplatesView({
  templates,
  allCount,
  searchQuery,
  onDelete,
  onEdit,
}: {
  templates: PackageTemplateRow[];
  allCount: number;
  searchQuery: string;
  onDelete: (t: PackageTemplateRow) => void;
  onEdit: (t: PackageTemplateRow) => void;
}) {
  if (templates.length === 0 && searchQuery) {
    return <NoResults message={`No package templates matching "${searchQuery}"`} />;
  }
  if (allCount === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No package templates yet"
        description={'Click "New Package" to create one, or save from any quote\'s packages page using the bookmark icon.'}
      />
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
      {templates.map((t) => {
        const featureCount = Array.isArray(t.tier?.features) ? t.tier!.features!.length : 0;
        return (
          <div
            key={t.id}
            role="button"
            tabIndex={0}
            onClick={() => onEdit(t)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(t); } }}
            className="group relative bg-white rounded-2xl border border-edge-strong p-4 hover:shadow-md hover:border-teal/30 transition-all text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-ink truncate">{t.name}</h3>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEdit(t); }}
                  className="p-1 text-faint hover:text-teal"
                  title="Edit"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(t); }}
                  className="p-1 text-faint hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            {t.description && (
              <p className="text-xs text-muted line-clamp-2 mb-3">{t.description}</p>
            )}
            <div className="flex items-center justify-between text-detail text-faint">
              <span>
                {featureCount} feature{featureCount === 1 ? '' : 's'}
              </span>
              <span>{new Date(t.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
