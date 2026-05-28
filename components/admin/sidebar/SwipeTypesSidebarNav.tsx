// components/admin/sidebar/SwipeTypesSidebarNav.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Folder, FolderOpen, MoreVertical, Pencil, Trash2, ChevronRight, Users } from 'lucide-react';
import { useSwipeFileContext } from '@/components/admin/ads/swipe/SwipeFileContext';
import SwipeFolderModal from '@/components/admin/ads/swipe/SwipeFolderModal';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { SwipeType } from '@/lib/supabase';

export default function SwipeTypesSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const swipe = useSwipeFileContext();
  const pathname = usePathname();
  const router = useRouter();
  const confirm = useConfirm();
  const [modal, setModal] = useState<{ open: boolean; type?: SwipeType }>({ open: false });
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const currentTypeId = pathname?.startsWith('/ads/swipe/')
    ? pathname.split('/')[3] || null
    : null;

  return (
    <>
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-surface-dark-hover transition-colors mb-1"
      >
        <ArrowLeft size={14} />
        <span>Back</span>
      </Link>

      <div className="px-3 pt-1 pb-2 flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-wider text-white/30">
          Swipe Vault
        </span>
      </div>

      <div className="space-y-0.5">
        {swipe.loading ? (
          <p className="text-xs text-white/40 px-3 py-2">Loading…</p>
        ) : swipe.types.length === 0 ? (
          <p className="text-xs text-white/40 px-3 py-2">No ad types yet</p>
        ) : (
          swipe.types.map((type) => {
            const active = type.id === currentTypeId;
            const isOwned = type.company_id === swipe.companyId;
            const isShared = !isOwned;
            const isSharedOut =
              isOwned && (type.shared_with_company_ids?.length || 0) > 0;
            return (
              <div key={type.id} className="group flex items-center gap-1 relative">
                <Link
                  href={`/ads/swipe/${type.id}`}
                  onClick={onNavigate}
                  className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-w-0 ${
                    active ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-surface-dark-hover'
                  }`}
                >
                  {active
                    ? <FolderOpen size={15} className="text-surface-dark-accent shrink-0" />
                    : <Folder size={15} className="text-white/40 group-hover:text-white/60 shrink-0" />}
                  <span className="flex-1 truncate">{type.name}</span>
                  {(isShared || isSharedOut) && (
                    <Users
                      size={11}
                      className="text-white/40 shrink-0"
                      aria-label={isShared ? 'Shared with you' : 'Shared with a partner'}
                    />
                  )}
                  <span className="text-2xs text-white/40 shrink-0">{type.file_count}</span>
                  {active && <ChevronRight size={12} className="text-surface-dark-accent/50 shrink-0" />}
                </Link>
                {/* Owner-only actions: rename / delete / change share list. */}
                {isOwned && (
                  <button
                    onClick={() => setMenuFor(menuFor === type.id ? null : type.id)}
                    className="absolute right-1 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-white/60"
                    aria-label="Type actions"
                  >
                    <MoreVertical size={13} />
                  </button>
                )}
                {isOwned && menuFor === type.id && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white border border-edge rounded-lg shadow-lg py-1">
                    <div className="fixed inset-0 -z-10" onClick={() => setMenuFor(null)} />
                    <button
                      onClick={() => { setModal({ open: true, type }); setMenuFor(null); }}
                      className="w-full text-left px-3 py-2 text-caption text-ink hover:bg-surface flex items-center gap-2"
                    >
                      <Pencil size={13} />
                      Rename & share
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await confirm({ title: 'Delete ad type', message: `Delete ad type "${type.name}" and all its swipes?`, confirmLabel: 'Delete', destructive: true });
                        if (ok) {
                          await swipe.deleteType(type.id);
                          if (currentTypeId === type.id) {
                            const next = swipe.types.find((t) => t.id !== type.id);
                            router.push(next ? `/ads/swipe/${next.id}` : '/ads/swipe');
                          }
                        }
                        setMenuFor(null);
                      }}
                      className="w-full text-left px-3 py-2 text-caption text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}

        <button
          onClick={() => setModal({ open: true })}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-surface-dark-accent hover:bg-surface-dark-hover transition-colors mt-1"
        >
          <Plus size={15} />
          New Ad Type
        </button>
      </div>

      {modal.open && (
        <SwipeFolderModal
          title={modal.type ? 'Rename Ad Type' : 'New Ad Type'}
          initialName={modal.type?.name || ''}
          initialDescription={modal.type?.description || ''}
          initialShared={modal.type?.shared_with_company_ids || []}
          shareTargets={swipe.shareTargets}
          onClose={() => setModal({ open: false })}
          onSave={async (data) => {
            if (modal.type) {
              await swipe.updateType(modal.type.id, data);
            } else {
              const result = await swipe.createType({
                name: data.name!,
                description: data.description,
                shared_with_company_ids: data.shared_with_company_ids,
              });
              if (result.data) router.push(`/ads/swipe/${result.data.id}`);
            }
            setModal({ open: false });
          }}
        />
      )}
    </>
  );
}
