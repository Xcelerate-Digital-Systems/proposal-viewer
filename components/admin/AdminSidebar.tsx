// components/admin/AdminSidebar.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, MessageSquareText, FileText, Files, LayoutTemplate,
  Palette, Bell, Users,
  LogOut, Menu, X, ChevronRight, Building2, ArrowLeft, ChevronDown,
  Check, Loader2, UserSquare2,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface SwitcherCompany {
  id: string;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Section definitions                                                */
/* ------------------------------------------------------------------ */

interface SectionDef {
  key: string;
  label: string;
  icon: LucideIcon;
  defaultHref: string;
  matchPaths: string[];
  items: NavItem[];
}

const ALL_SECTIONS: SectionDef[] = [
  {
    key: 'proposals',
    label: 'Proposals',
    icon: FileText,
    defaultHref: '/proposals',
    matchPaths: ['/proposals', '/documents', '/templates', '/template-preview'],
    items: [
      { href: '/proposals', label: 'Proposals', icon: FileText },
      { href: '/documents', label: 'Documents', icon: Files },
      { href: '/templates', label: 'Templates', icon: LayoutTemplate },
    ],
  },
  {
    key: 'reviews',
    label: 'Creative Review',
    icon: MessageSquareText,
    defaultHref: '/reviews',
    matchPaths: ['/reviews'],
    items: [
      { href: '/reviews', label: 'Projects', icon: MessageSquareText },
    ],
  },
];

const STANDALONE_ITEMS: NavItem[] = [
  { href: '/company', label: 'Branding', icon: Palette },
  { href: '/settings', label: 'Settings', icon: Bell },
  { href: '/team', label: 'Team', icon: Users },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getActiveSection(pathname: string, sections: SectionDef[]): SectionDef | null {
  for (const section of sections) {
    for (const matchPath of section.matchPaths) {
      if (matchPath === '/') {
        if (pathname === '/') return section;
      } else {
        if (pathname.startsWith(matchPath)) return section;
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Account Switcher — super admin only, agency accounts only          */
/* ------------------------------------------------------------------ */

function AccountSwitcher({
  companyOverride,
  onSetOverride,
  onClearOverride,
}: {
  companyOverride?: { companyId: string; companyName: string } | null;
  onSetOverride?: (companyId: string, companyName: string) => void;
  onClearOverride?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [agencies, setAgencies] = useState<SwitcherCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
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
        // /api/admin/accounts now returns agency accounts only
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
          {/* Return to own account */}
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

          {/* Agency list */}
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

          {/* Manage Agencies footer link */}
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

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function AdminSidebar({
  memberName,
  memberEmail,
  memberRole,
  companyId,
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

  // Creative Review visible to agency accounts only
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

  // Clients link: any agency account where the user is an agency admin or super admin
  const showClients = accountType === 'agency' && (isAgencyAdmin || isSuperAdmin);

  /* ---- Nav link ---- */
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

  /* ---- Section entry on top-level ---- */
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

  /* ---- Top-level navigation ---- */
  const renderTopLevelNav = () => (
    <>
      <div className="space-y-0.5">
        {renderNavLink({ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard })}
      </div>

      <div className="my-2 mx-3 border-t border-[#01434A]" />

      <div className="space-y-0.5">
        {visibleSections.map(renderSectionEntry)}
      </div>

      <div className="my-2 mx-3 border-t border-[#01434A]" />

      <div className="space-y-0.5">
        {showClients && renderNavLink({ href: '/clients', label: 'Clients', icon: UserSquare2 })}
        {STANDALONE_ITEMS.map((item) => renderNavLink(item))}
      </div>
    </>
  );

  /* ---- Section sub-navigation ---- */
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

  /* ---- Sidebar content ---- */
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Company override banner */}
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

      {/* AgencyViz branding */}
      <div className="px-4 py-5 border-b border-[#01434A]">
        <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-7" />
      </div>

      {/* Account switcher — super admin only */}
      {isSuperAdmin && (
        <div className="border-b border-[#01434A] py-2">
          <AccountSwitcher
            companyOverride={companyOverride}
            onSetOverride={onSetOverride}
            onClearOverride={onClearOverride}
          />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {isTopLevel
          ? renderTopLevelNav()
          : activeSection && renderSectionNav(activeSection)
        }
      </nav>

      {/* User section */}
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
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-[#043946] border border-[#01434A] rounded-lg flex items-center justify-center text-white/70 hover:text-white transition-colors"
      >
        <Menu size={18} />
      </button>

      {/* Mobile overlay */}
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

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[240px] lg:shrink-0 bg-[#043946] border-r border-[#01434A] h-screen sticky top-0">
        {sidebarContent}
      </aside>
    </>
  );
}