// components/admin/ads/swipe/SwipeFileManager.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Upload, Bookmark, X } from 'lucide-react';
import { useSwipeFileContext } from './SwipeFileContext';
import type { SwipeFile } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import SwipeFileForm from './SwipeFileForm';
import SwipeFileCard from './SwipeFileCard';
import SwipeBulkUploadModal from './SwipeBulkUploadModal';
import SwipeFileDetailModal from './SwipeFileDetailModal';

type Props = {
  companyId: string;
  typeId: string;
};

export default function SwipeFileManager({ companyId, typeId }: Props) {
  const swipe = useSwipeFileContext();
  const router = useRouter();

  const [fileForm, setFileForm] = useState<{ open: boolean; file?: SwipeFile }>({ open: false });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [customDomain, setCustomDomain] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('companies').select('custom_domain, domain_verified').eq('id', companyId).single()
      .then(({ data }) => { if (data?.domain_verified && data.custom_domain) setCustomDomain(data.custom_domain); });
  }, [companyId]);

  // Load files whenever typeId changes
  useEffect(() => {
    if (typeId) {
      swipe.fetchFilesForType(typeId);
      setActiveTags([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId]);

  // If the requested typeId isn't in the loaded list (e.g. deleted elsewhere), bounce
  useEffect(() => {
    if (swipe.loading) return;
    const exists = swipe.types.some((t) => t.id === typeId);
    if (!exists) {
      if (swipe.types[0]) router.replace(`/ads/swipe/${swipe.types[0].id}`);
      else router.replace('/ads/swipe');
    }
  }, [swipe.loading, swipe.types, typeId, router]);

  const currentType = swipe.types.find((t) => t.id === typeId) || null;
  const allFiles = swipe.filesByType[typeId] || [];

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    allFiles.forEach((f) => f.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [allFiles]);

  const files = useMemo(() => {
    if (activeTags.length === 0) return allFiles;
    return allFiles.filter((f) => activeTags.every((t) => f.tags?.includes(t)));
  }, [allFiles, activeTags]);

  const toggleTag = (t: string) => {
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-edge bg-ivory px-6 lg:px-10 py-6">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-faint">Swipe Vault</p>
            <h1 className="text-2xl font-semibold text-ink truncate">
              {currentType?.name || 'Swipe Vault'}
            </h1>
            {currentType?.description && (
              <p className="text-sm text-muted mt-1 whitespace-pre-line">{currentType.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setBulkOpen(true)}
              disabled={!currentType}
              className="flex items-center gap-2 bg-white border border-edge hover:border-teal/40 text-ink text-caption font-semibold rounded-[10px] px-4 py-2.5 disabled:opacity-40"
            >
              <Upload size={16} />
              Bulk Upload
            </button>
            <button
              onClick={() => setFileForm({ open: true })}
              disabled={!currentType}
              className="flex items-center gap-2 bg-teal hover:bg-teal-hover text-white text-caption font-semibold rounded-[10px] px-4 py-2.5 disabled:opacity-40"
            >
              <Plus size={16} />
              Add Swipe
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-ivory p-6 lg:p-10">
        {!currentType ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-faint">Loading…</p>
          </div>
        ) : (
          <>
            {/* Tag filter chips */}
            {availableTags.length > 0 && (
              <div className="flex items-center flex-wrap gap-1.5 mb-6">
                <span className="text-detail font-semibold uppercase tracking-wider text-faint mr-1">Tags:</span>
                {availableTags.map((t) => {
                  const on = activeTags.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className={`text-detail px-2.5 py-1 rounded-full border ${
                        on ? 'bg-teal text-white border-teal' : 'bg-white text-muted border-edge hover:border-teal/50'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
                {activeTags.length > 0 && (
                  <button
                    onClick={() => setActiveTags([])}
                    className="text-detail text-faint hover:text-ink flex items-center gap-1 ml-1"
                  >
                    <X size={11} /> Clear
                  </button>
                )}
              </div>
            )}

            {files.length === 0 ? (
              <div className="text-center py-20">
                <Bookmark size={28} className="text-faint mx-auto mb-3" />
                <p className="text-sm text-muted">
                  {allFiles.length === 0 ? 'No swipes in this folder yet' : 'No swipes match these tags'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                {files.map((file, idx) => (
                  <div
                    key={file.id}
                    onClick={() => setDetailIndex(idx)}
                    className="cursor-pointer hover:-translate-y-0.5 transition-transform"
                  >
                    <SwipeFileCard
                      file={file}
                      customDomain={customDomain}
                      onShared={async () => {
                        if (!file.has_been_shared) {
                          await swipe.updateFile(file.id, file.type_id, { has_been_shared: true });
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {detailIndex !== null && files[detailIndex] && (
        <SwipeFileDetailModal
          files={files}
          currentIndex={detailIndex}
          customDomain={customDomain}
          onNavigate={setDetailIndex}
          onClose={() => setDetailIndex(null)}
          onEdit={(f) => { setDetailIndex(null); setFileForm({ open: true, file: f }); }}
          onDelete={async (f) => {
            await swipe.deleteFile(f.id, f.type_id);
            setDetailIndex(null);
          }}
          onShared={async (f) => {
            if (!f.has_been_shared) {
              await swipe.updateFile(f.id, f.type_id, { has_been_shared: true });
            }
          }}
          onFieldUpdate={async (f, field, value) => {
            await swipe.updateFile(f.id, f.type_id, { [field]: value });
          }}
          types={swipe.types}
          onMove={async (f, newTypeId) => {
            await swipe.updateFile(f.id, f.type_id, { type_id: newTypeId });
            // The swipe just left the current folder's filtered view — close
            // the detail modal rather than trying to track it across lists.
            setDetailIndex(null);
            await Promise.all([
              swipe.fetchFilesForType(f.type_id),
              swipe.fetchFilesForType(newTypeId),
              swipe.fetchTypes(),
            ]);
          }}
        />
      )}

      {bulkOpen && typeId && (
        <SwipeBulkUploadModal
          typeId={typeId}
          uploadMedia={swipe.uploadMedia}
          createFile={swipe.createFile}
          onClose={() => setBulkOpen(false)}
          onComplete={() => swipe.fetchFilesForType(typeId)}
        />
      )}

      {fileForm.open && typeId && (
        <SwipeFileForm
          companyId={companyId}
          typeId={typeId}
          file={fileForm.file}
          knownTags={swipe.allTags}
          uploadMedia={swipe.uploadMedia}
          onClose={() => setFileForm({ open: false })}
          onSave={async (data) => {
            if (fileForm.file) {
              await swipe.updateFile(fileForm.file.id, fileForm.file.type_id, data);
            } else {
              await swipe.createFile({ type_id: typeId, title: data.title || 'Untitled', ...data });
            }
            setFileForm({ open: false });
          }}
        />
      )}
    </div>
  );
}
