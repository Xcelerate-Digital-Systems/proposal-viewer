// components/admin/AdminSidebar.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LogOut, Menu, X, ChevronRight, Building2, ArrowLeft, UserSquare2,
} from 'lucide-react';

import AccountSwitcher from './sidebar/AccountSwitcher';
import {
  ALL_SECTIONS, STANDALONE_ITEMS, getActiveSection, LayoutDashboard,
  type NavItem, type SectionDef,
} from './sidebar/sidebar-config';

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface AdminSidebarProps {
  memberName?: string;
  memberEmail?: string;
  memberRole?: string;
  companyId?: string;
  isSuperAdmin?: boolean;
  isAgencyAdmin?: boolean;
  accountType?: 'agency' | 'client';
  companyOverride?: { companyId: string; companyName: string } | null;
  onClearOverride?: () => void;
  onSetOverride?: (companyId: string, companyName: string) => void;
  onSignOut: () => Promise<void>;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function AdminSidebar({
  memberName,
  memberEmail,
  isSuperAdmin = false,
  isAgencyAdmin = false,
  accountType = 'agency',
  companyOverride,
  onClearOverride,
  onSetOverride,
  onSignOut,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleSections = ALL_SECTIONS.filter(
    (s) => s.key !== 'reviews' || accountType === 'agency'
  );

  const activeSection = getActiveSection(pathname, visibleSections);

  const isTopLevel =
    !activeSection ||
    pathname === '/dashboard' ||
    pathname === '/clients' ||
    (accountType !== 'agency' && activeSection.key === 'reviews');

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const initials = memberName
    ? memberName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const handleExitAccount = () => {
    if (onClearOverride) onClearOverride();
    window.location.href = '/';
  };

  const showClients = accountType === 'agency' && (isAgencyAdmin || isSuperAdmin);

  /* ── Nav link ──────────────────────────────────────────────── */

  const renderNavLink = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
          active
            ? 'bg-white/10 text-white'
            : 'text-white/60 hover:text-white hover:bg-[#013036]'
        }`}
      >
        <Icon
          size={18}
          className={active ? 'text-[#8AD9D1]' : 'text-white/40 group-hover:text-white/60'}
        />
        <span className="flex-1">{item.label}</span>
        {active && <ChevronRight size={14} className="text-[#8AD9D1]/50" />}
      </Link>
    );
  };

  /* ── Section entry on top-level ──────────────────────────── */

  const renderSectionEntry = (section: SectionDef) => {
    const Icon = section.icon;
    return (
      <Link
        key={section.key}
        href={section.defaultHref}
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group text-white/60 hover:text-white hover:bg-[#013036]"
      >
        <Icon size={18} className="text-white/40 group-hover:text-white/60" />
        <span className="flex-1">{section.label}</span>
        <ChevronRight size={14} className="text-white/20 group-hover:text-white/40" />
      </Link>
    );
  };

  /* ── Top-level navigation ──────────────────────────────────── */

  const renderTopLevelNav = () => (
    <>
      {/* WORKSPACE section */}
      <div className="px-3 pt-1 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[3px] text-[#8AD9D1]/50">
          Workspace
        </span>
      </div>
      <div className="space-y-0.5">
        {renderNavLink({ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard })}
        {visibleSections.map(renderSectionEntry)}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ACCOUNT section */}
      <div className="px-3 pt-1 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[3px] text-[#8AD9D1]/50">
          Account
        </span>
      </div>
      <div className="space-y-0.5">
        {showClients && renderNavLink({ href: '/clients', label: 'Clients', icon: UserSquare2 })}
        {STANDALONE_ITEMS.map((item) => renderNavLink(item))}
      </div>
    </>
  );

  /* ── Section sub-navigation ────────────────────────────────── */

  const renderSectionNav = (section: SectionDef) => (
    <>
      <Link
        href="/dashboard"
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-[#013036] transition-colors mb-1"
      >
        <ArrowLeft size={14} />
        <span>Back</span>
      </Link>
      <div className="px-3 pt-1 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
          {section.label}
        </span>
      </div>
      <div className="space-y-0.5">
        {section.items.map((item) => renderNavLink(item))}
      </div>
    </>
  );

  /* ── Sidebar content ───────────────────────────────────────── */

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {companyOverride && (
        <div className="px-3 py-2.5 bg-[#8AD9D1]/15 border-b border-[#01434A]">
          <div className="flex items-center gap-2 mb-1.5">
            <Building2 size={13} className="text-[#8AD9D1] shrink-0" />
            <span className="text-xs font-medium text-[#8AD9D1] truncate">
              {companyOverride.companyName}
            </span>
          </div>
          <button
            onClick={handleExitAccount}
            className="flex items-center gap-1.5 text-xs text-[#8AD9D1]/70 hover:text-[#8AD9D1] transition-colors"
          >
            <ArrowLeft size={11} />
            {isSuperAdmin ? 'Back to my account' : 'Back'}
          </button>
        </div>
      )}

      <div className="px-4 py-5 border-b border-[#01434A]">
        <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-7" />
      </div>

      {isSuperAdmin && (
        <div className="border-b border-[#01434A] py-2">
          <AccountSwitcher
            companyOverride={companyOverride}
            onSetOverride={onSetOverride}
            onClearOverride={onClearOverride}
          />
        </div>
      )}

      <nav className="flex-1 px-2 py-3 overflow-y-auto flex flex-col">
        {isTopLevel
          ? renderTopLevelNav()
          : activeSection && renderSectionNav(activeSection)
        }
      </nav>

      <div className="border-t border-[#01434A] p-3">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-[#013036] border border-[#01434A] flex items-center justify-center shrink-0">
            <span className="text-xs font-medium text-[#8AD9D1]">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">
              {memberName || 'Team Member'}
            </p>
            <p className="text-xs text-white/40 truncate">{memberEmail}</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-[#013036] transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-[#043946] border border-[#01434A] rounded-lg flex items-center justify-center text-white/70 hover:text-white transition-colors"
      >
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/40"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="w-[260px] h-full bg-[#043946] border-r border-[#01434A]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      <aside className="hidden lg:flex lg:flex-col lg:w-[240px] lg:shrink-0 bg-[#043946] border-r border-[#01434A] h-screen sticky top-0">
        {sidebarContent}
      </aside>
    </>
  );
}
