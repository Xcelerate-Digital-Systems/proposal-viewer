// components/admin/AdminSidebar.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText, LayoutTemplate, Users, Palette, Bell,
  LogOut, Menu, X, ChevronRight, Building2, ArrowLeft,
} from 'lucide-react';

interface AdminSidebarProps {
  memberName?: string;
  memberEmail?: string;
  memberRole?: string;
  companyId?: string;
  isSuperAdmin?: boolean;
  companyOverride?: { companyId: string; companyName: string } | null;
  onClearOverride?: () => void;
  onSignOut: () => Promise<void>;
}

const NAV_ITEMS = [
  { href: '/', label: 'Proposals', icon: FileText },
  { href: '/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/team', label: 'Team', icon: Users },
  { href: '/company', label: 'Branding', icon: Palette },
  { href: '/settings', label: 'Notifications', icon: Bell },
];

export default function AdminSidebar({
  memberName,
  memberEmail,
  memberRole,
  companyId,
  isSuperAdmin,
  companyOverride,
  onClearOverride,
  onSignOut,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const initials = memberName
    ? memberName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const handleExitAccount = () => {
    if (onClearOverride) onClearOverride();
    window.location.href = '/accounts';
  };

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
            Back to Accounts
          </button>
        </div>
      )}

      {/* AgencyViz branding */}
      <div className="px-4 py-5 border-b border-[#01434A]">
        <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-7" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {/* Super admin: Accounts link */}
        {isSuperAdmin && !companyOverride && (
          <Link
            href="/accounts"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
              pathname === '/accounts'
                ? 'bg-white/10 text-white'
                : 'text-white/60 hover:text-white hover:bg-[#013036]'
            }`}
          >
            <Building2
              size={18}
              className={pathname === '/accounts' ? 'text-[#8AD9D1]' : 'text-white/40 group-hover:text-white/60'}
            />
            <span className="flex-1">Accounts</span>
            {pathname === '/accounts' && (
              <ChevronRight size={14} className="text-[#8AD9D1]/50" />
            )}
          </Link>
        )}

        {/* Divider between Accounts and regular nav */}
        {isSuperAdmin && !companyOverride && (
          <div className="!my-2 border-t border-[#01434A]" />
        )}

        {NAV_ITEMS.map((item) => {
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
              {active && (
                <ChevronRight size={14} className="text-[#8AD9D1]/50" />
              )}
            </Link>
          );
        })}
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