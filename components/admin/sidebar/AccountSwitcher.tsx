// components/admin/sidebar/AccountSwitcher.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Building2, ArrowLeft, ChevronDown, Check, Loader2, UserSquare2,
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
  isAgencyAdmin?: boolean;
  isSuperAdmin?: boolean;
}

export default function AccountSwitcher({
  companyOverride,
  onSetOverride,
  onClearOverride,
  isAgencyAdmin = false,
  isSuperAdmin = false,
}: AccountSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [agencies, setAgencies] = useState<SwitcherCompany[]>([]);
  const [clients, setClients] = useState<SwitcherCompany[]>([]);
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

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const headers = { Authorization: `Bearer ${session.access_token}` };

      const fetches: Promise<void>[] = [];

      if (isSuperAdmin) {
        fetches.push(
          fetch('/api/admin/accounts', { headers }).then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              setAgencies(data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
            }
          }),
        );
      }

      if (isAgencyAdmin || isSuperAdmin) {
        fetches.push(
          fetch('/api/clients', { headers }).then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              setClients(
                (Array.isArray(data) ? data : []).map((c: { id: string; name: string }) => ({
                  id: c.id,
                  name: c.name,
                })),
              );
            }
          }),
        );
      }

      await Promise.all(fetches);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!open) fetchAccounts();
    setOpen((v) => !v);
  };

  const handleSelect = (company: SwitcherCompany) => {
    setOpen(false);
    if (onSetOverride) {
      onSetOverride(company.id, company.name);
      window.location.href = '/';
    }
  };

  const handleReturnToOwn = () => {
    setOpen(false);
    if (onClearOverride) onClearOverride();
    window.location.href = '/';
  };

  const activeLabel = companyOverride?.companyName ?? 'My Account';

  const renderCompanyRow = (company: SwitcherCompany, isClient = false) => (
    <button
      key={company.id}
      onClick={() => handleSelect(company)}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
        companyOverride?.companyId === company.id
          ? 'text-[#8AD9D1] bg-white/5'
          : 'text-white/60 hover:text-white hover:bg-white/5'
      }`}
    >
      <div
        className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-2xs font-bold"
        style={
          isClient
            ? { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }
            : { background: 'rgba(138,217,209,0.12)', color: '#8AD9D1' }
        }
      >
        {company.name.charAt(0).toUpperCase()}
      </div>
      <span className="flex-1 truncate text-left">{company.name}</span>
      {companyOverride?.companyId === company.id && <Check size={11} className="shrink-0" />}
    </button>
  );

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
        <div className="absolute left-2 right-2 top-full mt-1 bg-[#01282e] border border-[#01434A] rounded-2xl shadow-xl z-50 overflow-hidden">
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

          <div className="max-h-80 overflow-y-auto py-1.5">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={16} className="animate-spin text-white/30" />
              </div>
            ) : agencies.length === 0 && clients.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-4 px-3">No accounts found</p>
            ) : (
              <>
                {/* Agencies */}
                {agencies.length > 0 && (
                  <>
                    <p className="px-3 pt-1 pb-1 text-2xs font-semibold uppercase tracking-wider text-white/25">
                      Agencies
                    </p>
                    {agencies.map((a) => renderCompanyRow(a, false))}
                  </>
                )}

                {/* Clients */}
                {clients.length > 0 && (
                  <>
                    {agencies.length > 0 && <div className="mx-3 my-1.5 border-t border-[#01434A]" />}
                    <p className="px-3 pt-1 pb-1 text-2xs font-semibold uppercase tracking-wider text-white/25 flex items-center gap-1.5">
                      <UserSquare2 size={10} />
                      Client Accounts
                    </p>
                    {clients.map((c) => renderCompanyRow(c, true))}
                  </>
                )}
              </>
            )}
          </div>

          {isSuperAdmin && (
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
          )}
        </div>
      )}
    </div>
  );
}
