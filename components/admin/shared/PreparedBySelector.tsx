// components/admin/shared/PreparedBySelector.tsx
'use client';

import { useState, useEffect } from 'react';
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
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 transition-colors"
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin text-gray-400" />
        ) : selected ? (
          <>
            {selected.avatar_url ? (
              <img
                src={selected.avatar_url}
                alt=""
                className="w-6 h-6 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <User size={12} className="text-gray-400" />
              </div>
            )}
            <span className="flex-1 text-left text-gray-900 truncate">{selected.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
              className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <User size={14} className="text-gray-400 shrink-0" />
            <span className="flex-1 text-left text-gray-400">Select team member…</span>
          </>
        )}
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {members.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-400 text-center">
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
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                    m.id === selectedMemberId ? 'bg-[#017C87]/5' : ''
                  }`}
                >
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <User size={12} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-gray-900 truncate">{m.name}</div>
                    <div className="text-xs text-gray-400 truncate">{m.email}</div>
                  </div>
                  {m.id === selectedMemberId && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#017C87] shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}