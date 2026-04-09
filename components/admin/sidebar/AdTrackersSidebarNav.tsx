// components/admin/sidebar/AdTrackersSidebarNav.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Megaphone, MoreVertical, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { useAdTrackerContext } from '@/components/admin/ads/AdTrackerContext';
import CreateTrackerModal from '@/components/admin/ads/CreateTrackerModal';

export default function AdTrackersSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { trackers, loading, createTracker, updateTracker, deleteTracker } = useAdTrackerContext();
  const pathname = usePathname();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const currentTrackerId = pathname?.startsWith('/ads/')
    && !pathname.startsWith('/ads/swipe')
    && !pathname.startsWith('/ads/naming-convention')
    ? pathname.split('/')[2] || null
    : null;

  const startRename = (id: string, name: string) => {
    setRenamingId(id);
    setRenameValue(name);
    setMenuFor(null);
  };

  const commitRename = async (id: string) => {
    const name = renameValue.trim();
    if (name && name !== trackers.find((t) => t.id === id)?.name) {
      await updateTracker(id, { name });
    }
    setRenamingId(null);
    setRenameValue('');
  };

  return (
    <>
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-[#013036] transition-colors mb-1"
      >
        <ArrowLeft size={14} />
        <span>Back</span>
      </Link>

      <div className="px-3 pt-1 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
          Ad Tracker
        </span>
      </div>

      <div className="space-y-0.5">
        {loading ? (
          <p className="text-xs text-white/40 px-3 py-2">Loading…</p>
        ) : trackers.length === 0 ? (
          <p className="text-xs text-white/40 px-3 py-2">No campaigns yet</p>
        ) : (
          trackers.map((tracker) => {
            const active = tracker.id === currentTrackerId;
            const isRenaming = renamingId === tracker.id;
            return (
              <div key={tracker.id} className="group flex items-center gap-1 relative">
                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(tracker.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(tracker.id);
                      if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                    }}
                    className="flex-1 bg-[#013036] text-white text-sm rounded-lg px-3 py-2 outline-none border border-[#8AD9D1]/40"
                  />
                ) : (
                  <Link
                    href={`/ads/${tracker.id}`}
                    onClick={onNavigate}
                    className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-w-0 ${
                      active ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-[#013036]'
                    }`}
                  >
                    <Megaphone
                      size={15}
                      className={active ? 'text-[#8AD9D1] shrink-0' : 'text-white/40 group-hover:text-white/60 shrink-0'}
                    />
                    <span className="flex-1 truncate">{tracker.name}</span>
                    <span className="text-[10px] text-white/40 shrink-0">{tracker.creative_count}</span>
                    {active && <ChevronRight size={12} className="text-[#8AD9D1]/50 shrink-0" />}
                  </Link>
                )}
                {!isRenaming && (
                  <button
                    onClick={() => setMenuFor(menuFor === tracker.id ? null : tracker.id)}
                    className="absolute right-1 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-white/60"
                    aria-label="Campaign actions"
                  >
                    <MoreVertical size={13} />
                  </button>
                )}
                {menuFor === tracker.id && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white border border-edge rounded-lg shadow-lg py-1">
                    <div className="fixed inset-0 -z-10" onClick={() => setMenuFor(null)} />
                    <button
                      onClick={() => startRename(tracker.id, tracker.name)}
                      className="w-full text-left px-3 py-2 text-[13px] text-ink hover:bg-surface flex items-center gap-2"
                    >
                      <Pencil size={13} />
                      Rename
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete campaign "${tracker.name}" and all its creatives?`)) {
                          await deleteTracker(tracker.id);
                          if (currentTrackerId === tracker.id) {
                            const next = trackers.find((t) => t.id !== tracker.id);
                            router.push(next ? `/ads/${next.id}` : '/ads');
                          }
                        }
                        setMenuFor(null);
                      }}
                      className="w-full text-left px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 flex items-center gap-2"
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
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[#8AD9D1] hover:bg-[#013036] transition-colors mt-1"
        >
          <Plus size={15} />
          New Campaign
        </button>
      </div>

      {showCreate && (
        <CreateTrackerModal
          onClose={() => setShowCreate(false)}
          existingClients={Array.from(new Set(trackers.map((t) => t.client_name).filter(Boolean) as string[]))}
          onCreate={async (data) => {
            const result = await createTracker(data);
            if (!result.error && result.data) {
              setShowCreate(false);
              router.push(`/ads/${result.data.id}`);
            }
            return result;
          }}
        />
      )}
    </>
  );
}
