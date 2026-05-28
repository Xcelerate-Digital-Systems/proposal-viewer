// components/admin/sidebar/WorkspaceSwitcher.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Building2, ChevronDown, Check, ArrowLeft, Shield, UserSquare2,
} from 'lucide-react';
import { supabase, type TeamMember } from '@/lib/supabase';

interface WorkspaceSwitcherProps {
  memberships: TeamMember[];
  activeMembershipId: string | null;
  onSwitch: (membershipId: string) => void;
  isSuperAdmin?: boolean;
  isAgencyAdmin?: boolean;
  companyOverride?: { companyId: string; companyName: string } | null;
  onClearOverride?: () => void;
  onSetOverride?: (companyId: string, companyName: string) => void;
}

type CompanyLite = { id: string; name: string; account_type: 'agency' | 'client' };

export default function WorkspaceSwitcher({
  memberships,
  activeMembershipId,
  onSwitch,
  isSuperAdmin = false,
  isAgencyAdmin = false,
  companyOverride,
  onClearOverride,
  onSetOverride,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [companiesById, setCompaniesById] = useState<Record<string, CompanyLite>>({});
  const [clientAccounts, setClientAccounts] = useState<CompanyLite[]>([]);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = Array.from(new Set(memberships.map((m) => m.company_id)));
      if (ids.length === 0) { setCompaniesById({}); return; }
      const { data } = await supabase
        .from('companies')
        .select('id, name, account_type')
        .in('id', ids);
      if (cancelled || !data) return;
      const map: Record<string, CompanyLite> = {};
      for (const c of data) {
        map[c.id] = { id: c.id, name: c.name, account_type: c.account_type as 'agency' | 'client' };
      }
      setCompaniesById(map);
    })();
    return () => { cancelled = true; };
  }, [memberships]);

  useEffect(() => {
    if (!isAgencyAdmin && !isSuperAdmin) { setClientAccounts([]); return; }
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const res = await fetch('/api/clients', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setClientAccounts(
        (Array.isArray(data) ? data : []).map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
          account_type: 'client' as const,
        })),
      );
    })();
    return () => { cancelled = true; };
  }, [isAgencyAdmin, isSuperAdmin]);

  const activeMembership = memberships.find((m) => m.id === activeMembershipId) ?? null;
  const activeCompany = activeMembership ? companiesById[activeMembership.company_id] : null;

  const buttonLabel = companyOverride?.companyName || activeCompany?.name || 'My Workspace';

  const handleSelect = (membershipId: string) => {
    setOpen(false);
    onSwitch(membershipId);
    window.location.href = '/';
  };

  const handleSelectClient = (client: CompanyLite) => {
    setOpen(false);
    if (onSetOverride) {
      onSetOverride(client.id, client.name);
      window.location.href = '/';
    }
  };

  const handleReturnFromOverride = () => {
    setOpen(false);
    if (onClearOverride) onClearOverride();
    window.location.href = '/';
  };

  const showDropdownChevron = memberships.length > 1 || isSuperAdmin || !!companyOverride || clientAccounts.length > 0;
  const isOverridingClient = companyOverride && clientAccounts.some((c) => c.id === companyOverride.companyId);

  return (
    <div ref={dropdownRef} className="relative px-2 pb-2">
      <button
        onClick={() => showDropdownChevron && setOpen((v) => !v)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors group ${
          open
            ? 'bg-white/10 text-white'
            : 'text-white/70 hover:text-white hover:bg-surface-dark-hover'
        }`}
      >
        {isOverridingClient ? (
          <UserSquare2
            size={15}
            className={open ? 'text-surface-dark-accent shrink-0' : 'text-white/40 group-hover:text-white/60 shrink-0'}
          />
        ) : (
          <Building2
            size={15}
            className={open ? 'text-surface-dark-accent shrink-0' : 'text-white/40 group-hover:text-white/60 shrink-0'}
          />
        )}
        <span className="flex-1 truncate text-left text-xs font-medium">{buttonLabel}</span>
        {showDropdownChevron && (
          <ChevronDown
            size={13}
            className={`shrink-0 transition-transform ${open ? 'rotate-180 text-surface-dark-accent' : 'text-white/30'}`}
          />
        )}
      </button>

      {open && showDropdownChevron && (
        <div className="absolute left-2 right-2 top-full mt-1 bg-surface-dark-deep border border-surface-dark-border rounded-2xl shadow-xl z-50 overflow-hidden">
          {companyOverride && (
            <>
              <button
                onClick={handleReturnFromOverride}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-surface-dark-accent/80 hover:text-surface-dark-accent hover:bg-white/5 transition-colors"
              >
                <ArrowLeft size={12} />
                <span>Return to my account</span>
              </button>
              <div className="mx-3 border-t border-surface-dark-border" />
            </>
          )}

          <div className="max-h-80 overflow-y-auto py-1.5">
            {/* Agency workspaces */}
            {memberships.length > 0 && (
              <>
                <p className="px-3 pt-1 pb-1 text-2xs font-semibold uppercase tracking-wider text-white/25">
                  {clientAccounts.length > 0 ? 'Agency Accounts' : 'My Workspaces'}
                </p>
                {memberships.map((m) => {
                  const company = companiesById[m.company_id];
                  const isActive = m.id === activeMembershipId && !companyOverride;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleSelect(m.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                        isActive
                          ? 'text-surface-dark-accent bg-white/5'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-2xs font-bold bg-surface-dark-accent/[0.12] text-surface-dark-accent"
                      >
                        {(company?.name ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 min-w-0 text-left">
                        <span className="block truncate">{company?.name ?? 'Workspace'}</span>
                        <span className="block text-2xs text-white/30 truncate capitalize">{m.role}</span>
                      </span>
                      {isActive && <Check size={11} className="shrink-0" />}
                    </button>
                  );
                })}
              </>
            )}

            {/* Client accounts */}
            {clientAccounts.length > 0 && (
              <>
                <div className="mx-3 my-1.5 border-t border-surface-dark-border" />
                <p className="px-3 pt-1 pb-1 text-2xs font-semibold uppercase tracking-wider text-white/25 flex items-center gap-1.5">
                  <UserSquare2 size={10} />
                  Client Accounts
                </p>
                {clientAccounts.map((client) => {
                  const isActive = companyOverride?.companyId === client.id;
                  return (
                    <button
                      key={client.id}
                      onClick={() => handleSelectClient(client)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                        isActive
                          ? 'text-surface-dark-accent bg-white/5'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-2xs font-bold"
                        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
                      >
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 truncate text-left">{client.name}</span>
                      {isActive && <Check size={11} className="shrink-0" />}
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {isSuperAdmin && (
            <>
              <div className="border-t border-surface-dark-border" />
              <Link
                href="/accounts"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/70 hover:text-surface-dark-accent hover:bg-white/5 transition-colors"
              >
                <Shield size={13} className="text-surface-dark-accent/80" />
                <span className="flex-1">Platform Admin</span>
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
