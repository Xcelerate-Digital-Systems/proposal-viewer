// components/admin/shared/PreparedBySelector.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, ChevronDown, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface TeamMemberOption {
  id: string;
  name: string;
  email: string;
  avatar_path: string | null;
  avatar_url?: string | null;
}

interface PreparedBySelectorProps {
  companyId: string;
  selectedMemberId: string | null;
  onSelect: (memberId: string | null) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PreparedBySelector({
  companyId,
  selectedMemberId,
  onSelect,
}: PreparedBySelectorProps) {
  const [members, setMembers] = useState<TeamMemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const triggerBtnRef = useRef<HTMLButtonElement>(null);
  const [ddPos, setDdPos] = useState<{ top: number; left: number; width: number } | null>(null);

  /* ── Fetch team members for this company ───────────────── */
  useEffect(() => {
    const fetchMembers = async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, email, avatar_path')
        .eq('company_id', companyId)
        .order('name');

      if (!error && data) {
        // Resolve avatar URLs for members that have one
        const withUrls = await Promise.all(
          data.map(async (m) => {
            let avatar_url: string | null = null;
            if (m.avatar_path) {
              const { data: urlData } = await supabase.storage
                .from('proposals')
                .createSignedUrl(m.avatar_path, 3600);
              avatar_url = urlData?.signedUrl || null;
            }
            return { ...m, avatar_url };
          })
        );
        setMembers(withUrls);
      }
      setLoading(false);
    };

    fetchMembers();
  }, [companyId]);

  const selected = members.find((m) => m.id === selectedMemberId);

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        ref={triggerBtnRef}
        type="button"
        onClick={() => {
          if (!open && triggerBtnRef.current) {
            const r = triggerBtnRef.current.getBoundingClientRect();
            setDdPos({ top: r.bottom + 4, left: r.left, width: r.width });
          }
          setOpen(!open);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-edge-strong bg-white text-sm hover:border-edge-hover focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 transition-colors"
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin text-faint" />
        ) : selected ? (
          <>
            {selected.avatar_url ? (
              <img
                src={selected.avatar_url}
                alt=""
                className="w-6 h-6 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-surface flex items-center justify-center shrink-0">
                <User size={12} className="text-faint" />
              </div>
            )}
            <span className="flex-1 text-left text-ink truncate">{selected.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
              className="p-0.5 text-faint hover:text-prose transition-colors"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <User size={14} className="text-faint shrink-0" />
            <span className="flex-1 text-left text-faint">Select team member…</span>
          </>
        )}
        <ChevronDown size={14} className={`text-faint shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown — portal to escape parent stacking context */}
      {open && ddPos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[9999] bg-white border border-edge-strong rounded-lg shadow-lg max-h-48 overflow-y-auto"
            style={{ top: ddPos.top, left: ddPos.left, width: ddPos.width }}
          >
            {members.length === 0 ? (
              <div className="px-3 py-3 text-sm text-faint text-center">
                No team members found
              </div>
            ) : (
              members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelect(m.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-surface transition-colors ${
                    m.id === selectedMemberId ? 'bg-teal/5' : ''
                  }`}
                >
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-surface flex items-center justify-center shrink-0">
                      <User size={12} className="text-faint" />
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-ink truncate">{m.name}</div>
                    <div className="text-xs text-faint truncate">{m.email}</div>
                  </div>
                  {m.id === selectedMemberId && (
                    <div className="w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}