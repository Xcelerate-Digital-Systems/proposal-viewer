// components/admin/AdminSidebar.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LogOut, Menu, X, ChevronRight, Building2, ArrowLeft, UserSquare2, Shield,
} from 'lucide-react';

import NotificationBell from '@/components/admin/NotificationBell';
import WorkspaceSwitcher from './sidebar/WorkspaceSwitcher';
import SwipeTypesSidebarNav from './sidebar/SwipeTypesSidebarNav';
import FeedbackItemsSidebarNav from './sidebar/FeedbackItemsSidebarNav';
import {
  ALL_SECTIONS, STANDALONE_ITEMS, WORKSPACE_ITEMS, getActiveSection, LayoutDashboard,
  type NavItem, type SectionDef,
} from './sidebar/sidebar-config';
import type { TeamMember } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { SidebarBranding } from '@/hooks/useCompanyBranding';

interface AdminSidebarProps {
  memberName?: string;
  memberEmail?: string;
  memberRole?: string;
  memberAvatarPath?: string | null;
  companyId?: string;
  userId?: string | null;
  isSuperAdmin?: boolean;
  isAgencyAdmin?: boolean;
  accountType?: 'agency' | 'client';
  companyOverride?: { companyId: string; companyName: string } | null;
  onClearOverride?: () => void;
  onSetOverride?: (companyId: string, companyName: string) => void;
  memberships?: TeamMember[];
  activeMembershipId?: string | null;
  onSwitchMembership?: (membershipId: string) => void;
  onSignOut: () => Promise<void>;
  sidebarBranding?: SidebarBranding | null;
}

interface SidebarColors {
  bg: string;
  bgHover: string;
  border: string;
  accent: string;
  text: string;
  textMuted: string;
  textFaint: string;
  activeItemBg: string;
}

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}


export default function AdminSidebar({
  memberName,
  memberEmail,
  memberAvatarPath,
  companyId,
  userId = null,
  isSuperAdmin = false,
  isAgencyAdmin = false,
  accountType = 'agency',
  companyOverride,
  onClearOverride,
  onSetOverride,
  memberships = [],
  activeMembershipId = null,
  onSwitchMembership,
  onSignOut,
  sidebarBranding = null,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const branded = !!sidebarBranding;

  const c = useMemo<SidebarColors>(() => {
    if (!sidebarBranding) {
      return {
        bg: '', bgHover: '', border: '', accent: '', text: '',
        textMuted: '', textFaint: '', activeItemBg: '',
      };
    }
    const { palette } = sidebarBranding;
    return {
      bg: palette.bg,
      bgHover: palette.bgElevated,
      border: palette.border,
      accent: palette.accent,
      text: palette.sidebarText,
      textMuted: palette.mutedText,
      textFaint: palette.faintText,
      activeItemBg: palette.accentSurface,
    };
  }, [sidebarBranding]);

  useEffect(() => {
    if (!memberAvatarPath) { setAvatarUrl(null); return; }
    let cancelled = false;
    supabase.storage.from('proposals').createSignedUrl(memberAvatarPath, 3600).then(({ data }) => {
      if (!cancelled) setAvatarUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [memberAvatarPath]);

  const CLIENT_ALLOWED_SECTIONS = new Set(['pitch']);
  const visibleSections = ALL_SECTIONS.filter((s) => {
    if (accountType === 'client') return CLIENT_ALLOWED_SECTIONS.has(s.key);
    if (s.key === 'campaigns' && accountType !== 'agency') return false;
    return true;
  });

  const activeSection = getActiveSection(pathname, visibleSections);
  const inSwipeSection = pathname.startsWith('/ads/swipe');
  const inFeedbackBoard = /^\/feedback\/[^/]+\/board/.test(pathname);

  const isTopLevel =
    !inSwipeSection && !inFeedbackBoard && (
      !activeSection ||
      pathname === '/dashboard' ||
      pathname === '/clients' ||
      (accountType !== 'agency' && activeSection.key === 'campaigns') ||
      (activeSection && activeSection.items.length <= 1)
    );

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

    if (branded) {
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-2 rounded-full text-sm font-medium transition-colors group"
          style={{
            color: active ? c.text : c.textMuted,
            backgroundColor: active ? c.activeItemBg : 'transparent',
          }}
          onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = c.bgHover; e.currentTarget.style.color = c.text; }}
          onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = c.textMuted; }}
        >
          <Icon size={18} style={{ color: active ? c.accent : c.textFaint }} />
          <span className="flex-1">{item.label}</span>
          {active && <ChevronRight size={14} style={{ color: hexWithAlpha(c.accent, 0.5) }} />}
        </Link>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-3 py-2 rounded-full text-sm font-medium transition-colors group ${
          active
            ? 'bg-white/10 text-white'
            : 'text-white/60 hover:text-white hover:bg-surface-dark-hover'
        }`}
      >
        <Icon
          size={18}
          className={active ? 'text-surface-dark-accent' : 'text-white/40 group-hover:text-white/60'}
        />
        <span className="flex-1">{item.label}</span>
        {active && <ChevronRight size={14} className="text-surface-dark-accent/50" />}
      </Link>
    );
  };

  /* ── Section entry on top-level ──────────────────────────── */

  const renderSectionEntry = (section: SectionDef) => {
    const Icon = section.icon;

    if (branded) {
      return (
        <Link
          key={section.key}
          href={section.defaultHref}
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-2 rounded-full text-sm font-medium transition-colors group"
          style={{ color: c.textMuted }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = c.bgHover; e.currentTarget.style.color = c.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = c.textMuted; }}
        >
          <Icon size={18} style={{ color: c.textFaint }} />
          <span className="flex-1">{section.label}</span>
          <ChevronRight size={14} style={{ color: hexWithAlpha(c.text, 0.2) }} />
        </Link>
      );
    }

    return (
      <Link
        key={section.key}
        href={section.defaultHref}
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-3 px-3 py-2 rounded-full text-sm font-medium transition-colors group text-white/60 hover:text-white hover:bg-surface-dark-hover"
      >
        <Icon size={18} className="text-white/40 group-hover:text-white/60" />
        <span className="flex-1">{section.label}</span>
        <ChevronRight size={14} className="text-white/20 group-hover:text-white/40" />
      </Link>
    );
  };

  /* ── Top-level navigation ──────────────────────────────────── */

  const renderTopLevelNav = () => (
    <div className="animate-nav-fade contents">
      <div className="px-3 pt-1 pb-2">
        <span
          className={branded ? 'text-2xs font-semibold uppercase tracking-[3px]' : 'text-2xs font-semibold uppercase tracking-[3px] text-surface-dark-accent/50'}
          style={branded ? { color: hexWithAlpha(c.accent, 0.5) } : undefined}
        >
          Workspace
        </span>
      </div>
      <div className="space-y-0.5">
        {renderNavLink({ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard })}
        {visibleSections.map((section) =>
          section.items.length <= 1
            ? renderNavLink({ href: section.defaultHref, label: section.label, icon: section.icon })
            : renderSectionEntry(section)
        )}
        {accountType !== 'client' && WORKSPACE_ITEMS.map((item) => renderNavLink(item))}
      </div>

      <div className="flex-1" />

      <div className="px-3 pt-1 pb-2">
        <span
          className={branded ? 'text-2xs font-semibold uppercase tracking-[3px]' : 'text-2xs font-semibold uppercase tracking-[3px] text-surface-dark-accent/50'}
          style={branded ? { color: hexWithAlpha(c.accent, 0.5) } : undefined}
        >
          Account
        </span>
      </div>
      <div className="space-y-0.5">
        {showClients && renderNavLink({ href: '/clients', label: 'Clients', icon: UserSquare2 })}
        {isSuperAdmin && renderNavLink({ href: '/accounts', label: 'Accounts', icon: Shield })}
        {STANDALONE_ITEMS.filter((item) =>
          accountType === 'client' ? item.href === '/settings' : true
        ).map((item) => renderNavLink(item))}
      </div>
    </div>
  );

  /* ── Section sub-navigation ────────────────────────────────── */

  const renderSectionNav = (section: SectionDef) => (
    <div className="animate-nav-fade contents">
      <Link
        href="/dashboard"
        onClick={() => setMobileOpen(false)}
        className={branded ? 'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors mb-1' : 'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm text-white/50 hover:text-white hover:bg-surface-dark-hover transition-colors mb-1'}
        style={branded ? { color: c.textMuted } : undefined}
        onMouseEnter={branded ? (e) => { e.currentTarget.style.backgroundColor = c.bgHover; e.currentTarget.style.color = c.text; } : undefined}
        onMouseLeave={branded ? (e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = c.textMuted; } : undefined}
      >
        <ArrowLeft size={14} />
        <span>Back</span>
      </Link>
      <div className="px-3 pt-1 pb-2">
        <span
          className={branded ? 'text-2xs font-semibold uppercase tracking-wider' : 'text-2xs font-semibold uppercase tracking-wider text-white/30'}
          style={branded ? { color: hexWithAlpha(c.text, 0.3) } : undefined}
        >
          {section.label}
        </span>
      </div>
      <div className="space-y-0.5">
        {section.items.map((item) => renderNavLink(item))}
      </div>
    </div>
  );

  /* ── Sidebar content ───────────────────────────────────────── */

  const sidebarContent = (
    <div className="flex flex-col h-full" data-tour="sidebar">
      {companyOverride && (
        <div
          className={branded ? 'px-3 py-2.5 border-b' : 'px-3 py-2.5 bg-surface-dark-accent/15 border-b border-surface-dark-border'}
          style={branded ? { backgroundColor: hexWithAlpha(c.accent, 0.15), borderColor: c.border } : undefined}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Building2 size={13} style={branded ? { color: c.accent } : undefined} className={branded ? 'shrink-0' : 'text-surface-dark-accent shrink-0'} />
            <span
              className={branded ? 'text-xs font-medium truncate' : 'text-xs font-medium text-surface-dark-accent truncate'}
              style={branded ? { color: c.accent } : undefined}
            >
              {companyOverride.companyName}
            </span>
          </div>
          <button
            onClick={handleExitAccount}
            className={branded ? 'flex items-center gap-1.5 text-xs transition-colors' : 'flex items-center gap-1.5 text-xs text-surface-dark-accent/70 hover:text-surface-dark-accent transition-colors'}
            style={branded ? { color: hexWithAlpha(c.accent, 0.7) } : undefined}
          >
            <ArrowLeft size={11} />
            {isSuperAdmin ? 'Back to my account' : 'Back'}
          </button>
        </div>
      )}

      <div
        className={branded ? 'px-4 py-5 border-b' : 'px-4 py-5 border-b border-surface-dark-border'}
        style={branded ? { borderColor: c.border } : undefined}
      >
        {sidebarBranding?.logoUrl ? (
          <img src={sidebarBranding.logoUrl} alt={sidebarBranding.companyName} className="h-7 max-w-[160px] object-contain" />
        ) : (
          <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-7" />
        )}
      </div>

      {(memberships.length > 1 || isSuperAdmin || isAgencyAdmin || !!companyOverride) && (
        <div
          className={branded ? 'border-b py-2' : 'border-b border-surface-dark-border py-2'}
          style={branded ? { borderColor: c.border } : undefined}
        >
          <WorkspaceSwitcher
            memberships={memberships}
            activeMembershipId={activeMembershipId}
            onSwitch={(id) => onSwitchMembership?.(id)}
            isSuperAdmin={isSuperAdmin}
            isAgencyAdmin={isAgencyAdmin}
            companyOverride={companyOverride}
            onClearOverride={onClearOverride}
            onSetOverride={onSetOverride}
          />
        </div>
      )}

      <nav className="flex-1 px-2 py-3 overflow-y-auto flex flex-col">
        {inSwipeSection
          ? <SwipeTypesSidebarNav onNavigate={() => setMobileOpen(false)} />
          : inFeedbackBoard
            ? <FeedbackItemsSidebarNav onNavigate={() => setMobileOpen(false)} />
            : isTopLevel
              ? renderTopLevelNav()
              : activeSection && renderSectionNav(activeSection)
        }
      </nav>

      <div
        className={branded ? 'border-t p-3' : 'border-t border-surface-dark-border p-3'}
        style={branded ? { borderColor: c.border } : undefined}
      >
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={memberName || 'Avatar'}
              className="w-8 h-8 rounded-full object-cover shrink-0 border"
              style={branded ? { borderColor: c.border } : undefined}
            />
          ) : (
            <div
              className={branded ? 'w-8 h-8 rounded-full border flex items-center justify-center shrink-0' : 'w-8 h-8 rounded-full bg-surface-dark-hover border border-surface-dark-border flex items-center justify-center shrink-0'}
              style={branded ? { backgroundColor: c.bgHover, borderColor: c.border } : undefined}
            >
              <span
                className={branded ? 'text-xs font-medium' : 'text-xs font-medium text-surface-dark-accent'}
                style={branded ? { color: c.accent } : undefined}
              >
                {initials}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p
              className={branded ? 'text-sm font-medium truncate' : 'text-sm font-medium text-white truncate'}
              style={branded ? { color: c.text } : undefined}
            >
              {memberName || 'Team Member'}
            </p>
            <p
              className={branded ? 'text-xs truncate' : 'text-xs text-white/40 truncate'}
              style={branded ? { color: c.textFaint } : undefined}
            >
              {memberEmail}
            </p>
          </div>
          <NotificationBell
            userId={userId ?? null}
            companyId={companyId ?? null}
            variant="sidebar"
          />
        </div>
        <button
          onClick={onSignOut}
          className={branded ? 'flex items-center gap-3 w-full px-3 py-1.5 rounded-full text-sm transition-colors' : 'flex items-center gap-3 w-full px-3 py-1.5 rounded-full text-sm text-white/50 hover:text-white hover:bg-surface-dark-hover transition-colors'}
          style={branded ? { color: c.textMuted } : undefined}
          onMouseEnter={branded ? (e) => { e.currentTarget.style.backgroundColor = c.bgHover; e.currentTarget.style.color = c.text; } : undefined}
          onMouseLeave={branded ? (e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = c.textMuted; } : undefined}
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );

  const containerStyle = branded ? {
    backgroundColor: c.bg,
    borderColor: c.border,
  } : undefined;

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className={branded ? 'lg:hidden fixed top-4 left-4 z-50 w-10 h-10 border rounded-lg flex items-center justify-center transition-colors' : 'lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-surface-dark border border-surface-dark-border rounded-lg flex items-center justify-center text-white/70 hover:text-white transition-colors'}
        style={branded ? { backgroundColor: c.bg, borderColor: c.border, color: c.textMuted } : undefined}
      >
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/40"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className={branded ? 'w-[260px] h-full border-r' : 'w-[260px] h-full bg-surface-dark border-r border-surface-dark-border'}
            onClick={(e) => e.stopPropagation()}
            style={containerStyle}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4"
              style={branded ? { color: c.textFaint } : undefined}
            >
              <X size={18} className={branded ? '' : 'text-white/40 hover:text-white'} />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      <aside
        className={branded ? 'hidden lg:flex lg:flex-col lg:w-[240px] lg:shrink-0 border-r h-screen sticky top-0' : 'hidden lg:flex lg:flex-col lg:w-[240px] lg:shrink-0 bg-surface-dark border-r border-surface-dark-border h-screen sticky top-0'}
        style={containerStyle}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
