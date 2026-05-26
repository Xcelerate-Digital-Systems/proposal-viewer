// components/admin/sidebar/WorkspaceSwitcher.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Building2, ChevronDown, Check, ArrowLeft, Shield,
} from 'lucide-react';
import { supabase, type TeamMember } from '@/lib/supabase';

/**
 * Workspace switcher (Stage 2 of the multi-workspace refactor).
 *
 * Lists the workspaces the user is a *real* team_member of (Markup.io-style:
 * one auth identity, N workspace memberships), plus a "Platform Admin" link
 * for super admins. Switching between real workspaces never goes through
 * the company-override mechanism — that path stays as a super-admin
 * escape hatch driven from /admin (Stage 3).
 *
 * If an override IS active when this opens (e.g. a super admin used "view
 * as" on /admin), we render a header strip with a one-click return to the
 * active workspace.
 */
interface WorkspaceSwitcherProps {
  memberships: TeamMember[];
  activeMembershipId: string | null;
  onSwitch: (membershipId: string) => void;
  isSuperAdmin?: boolean;
  /** Active "view as" override (from useAuth). Surfaced for context only. */
  companyOverride?: { companyId: string; companyName: string } | null;
  onClearOverride?: () => void;
}

type CompanyLite = { id: string; name: string; account_type: 'agency' | 'client' };

export default function WorkspaceSwitcher({
  memberships,
  activeMembershipId,
  onSwitch,
  isSuperAdmin = false,
  companyOverride,
  onClearOverride,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [companiesById, setCompaniesById] = useState<Record<string, CompanyLite>>({});
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

  // Fetch company name + type for each membership in one round trip.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = Array.from(new Set(memberships.map((m) => m.company_id)));
      if (ids.length === 0) {
        setCompaniesById({});
        return;
      }
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
    return () => {
      cancelled = true;
    };
  }, [memberships]);

  const activeMembership = memberships.find((m) => m.id === activeMembershipId) ?? null;
  const activeCompany = activeMembership ? companiesById[activeMembership.company_id] : null;

  // When a super admin has overridden to view another company, that label
  // takes over the button so the chrome reflects what you're actually
  // looking at (matches the prior AccountSwitcher behaviour).
  const buttonLabel = companyOverride?.companyName
    || activeCompany?.name
    || 'My Workspace';

  const handleSelect = (membershipId: string) => {
    setOpen(false);
    onSwitch(membershipId);
    // Hard nav so any in-flight queries scoped to the old workspace don't
    // come back and overwrite state with stale rows.
    window.location.href = '/';
  };

  const handleReturnFromOverride = () => {
    setOpen(false);
    if (onClearOverride) onClearOverride();
    window.location.href = '/';
  };

  // Single-membership + not super admin: no dropdown affordance, just a
  // labelled chip. (Keeps the chrome compact for normal users.)
  const showDropdownChevron = memberships.length > 1 || isSuperAdmin || !!companyOverride;

  return (
    <div ref={dropdownRef} className="relative px-2 pb-2">
      <button
        onClick={() => showDropdownChevron && setOpen((v) => !v)}
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
        <span className="flex-1 truncate text-left text-xs font-medium">{buttonLabel}</span>
        {showDropdownChevron && (
          <ChevronDown
            size={13}
            className={`shrink-0 transition-transform ${open ? 'rotate-180 text-[#8AD9D1]' : 'text-white/30'}`}
          />
        )}
      </button>

      {open && showDropdownChevron && (
        <div className="absolute left-2 right-2 top-full mt-1 bg-[#01282e] border border-[#01434A] rounded-xl shadow-xl z-50 overflow-hidden">
          {companyOverride && (
            <>
              <button
                onClick={handleReturnFromOverride}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-[#8AD9D1]/80 hover:text-[#8AD9D1] hover:bg-white/5 transition-colors"
              >
                <ArrowLeft size={12} />
                <span>Stop viewing {companyOverride.companyName}</span>
              </button>
              <div className="mx-3 border-t border-[#01434A]" />
            </>
          )}

          {memberships.length > 0 && (
            <>
              <p className="px-3 pt-2.5 pb-1 text-2xs font-semibold uppercase tracking-wider text-white/25">
                My Workspaces
              </p>
              <div className="max-h-64 overflow-y-auto py-1">
                {memberships.map((m) => {
                  const company = companiesById[m.company_id];
                  const isActive = m.id === activeMembershipId && !companyOverride;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleSelect(m.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                        isActive
                          ? 'text-[#8AD9D1] bg-white/5'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-2xs font-bold"
                        style={{ background: 'rgba(138,217,209,0.12)', color: '#8AD9D1' }}
                      >
                        {(company?.name ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 min-w-0 text-left">
                        <span className="block truncate">{company?.name ?? 'Workspace'}</span>
                        <span className="block text-2xs text-white/30 truncate capitalize">
                          {m.role}{company?.account_type === 'client' ? ' · client' : ''}
                        </span>
                      </span>
                      {isActive && <Check size={11} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {isSuperAdmin && (
            <>
              <div className="border-t border-[#01434A]" />
              <Link
                href="/accounts"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/70 hover:text-[#8AD9D1] hover:bg-white/5 transition-colors"
              >
                <Shield size={13} className="text-[#8AD9D1]/80" />
                <span className="flex-1">Platform Admin</span>
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
