// components/admin/sidebar/AccountSwitcher.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Building2, ArrowLeft, ChevronDown, Check, Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SwitcherCompany {
  id: string;
  name: string;
}

interface AccountSwitcherProps {
  companyOverride?: { companyId: string; companyName: string } | null;
  onSetOverride?: (companyId: string, companyName: string) => void;
  onClearOverride?: () => void;
}

export default function AccountSwitcher({
  companyOverride,
  onSetOverride,
  onClearOverride,
}: AccountSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [agencies, setAgencies] = useState<SwitcherCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAgencies = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/admin/accounts', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAgencies(data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!open) fetchAgencies();
    setOpen((v) => !v);
  };

  const handleSelect = (agency: SwitcherCompany) => {
    setOpen(false);
    if (onSetOverride) {
      onSetOverride(agency.id, agency.name);
      window.location.href = '/';
    }
  };

  const handleReturnToOwn = () => {
    setOpen(false);
    if (onClearOverride) onClearOverride();
    window.location.href = '/';
  };

  const activeLabel = companyOverride?.companyName ?? 'My Account';

  return (
    <div ref={dropdownRef} className="relative px-2 pb-2">
      <button
        onClick={handleToggle}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors group ${
          open
            ? 'bg-white/10 text-white'
            : 'text-white/70 hover:text-white hover:bg-[#013036]'
        }`}
      >
        <Building2
          size={15}
          className={open ? 'text-[#8AD9D1] shrink-0' : 'text-white/40 group-hover:text-white/60 shrink-0'}
        />
        <span className="flex-1 truncate text-left text-xs font-medium">{activeLabel}</span>
        <ChevronDown
          size={13}
          className={`shrink-0 transition-transform ${open ? 'rotate-180 text-[#8AD9D1]' : 'text-white/30'}`}
        />
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full mt-1 bg-[#01282e] border border-[#01434A] rounded-xl shadow-xl z-50 overflow-hidden">
          {companyOverride && (
            <>
              <button
                onClick={handleReturnToOwn}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-[#8AD9D1]/80 hover:text-[#8AD9D1] hover:bg-white/5 transition-colors"
              >
                <ArrowLeft size={12} />
                <span>Return to my account</span>
              </button>
              <div className="mx-3 border-t border-[#01434A]" />
            </>
          )}

          <div className="max-h-64 overflow-y-auto py-1.5">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={16} className="animate-spin text-white/30" />
              </div>
            ) : agencies.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-4 px-3">No agencies found</p>
            ) : (
              <>
                <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                  Agencies
                </p>
                {agencies.map((agency) => (
                  <button
                    key={agency.id}
                    onClick={() => handleSelect(agency)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                      companyOverride?.companyId === agency.id
                        ? 'text-[#8AD9D1] bg-white/5'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-[10px] font-bold"
                      style={{ background: 'rgba(138,217,209,0.12)', color: '#8AD9D1' }}
                    >
                      {agency.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 truncate text-left">{agency.name}</span>
                    {companyOverride?.companyId === agency.id && <Check size={11} className="shrink-0" />}
                  </button>
                ))}
              </>
            )}
          </div>

          <div className="border-t border-[#01434A] px-3 py-2">
            <Link
              href="/accounts"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60 transition-colors py-1"
            >
              <Building2 size={12} />
              Manage Agencies
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
