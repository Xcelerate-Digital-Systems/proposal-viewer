// components/admin/AdminSidebar.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText, LayoutTemplate, Users, Palette, Bell,
  LogOut, Menu, X, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AdminSidebarProps {
  memberName?: string;
  memberEmail?: string;
  memberRole?: string;
  companyId?: string;
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
  onSignOut,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/company/branding?company_id=${companyId}`)
      .then((r) => r.json())
      .then((data) => {
        setLogoUrl(data.logo_url || null);
        setCompanyName(data.name || '');
      })
      .catch(() => {});
  }, [companyId]);

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

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Company branding */}
      <div className="px-4 py-5 border-b border-[#2a2a2a]">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={companyName}
            className="h-7 max-w-[160px] object-contain"
          />
        ) : companyName ? (
          <span className="text-sm font-semibold text-white truncate">
            {companyName}
          </span>
        ) : (
          <img src="/logo-white.svg" alt="Logo" className="h-7" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
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
                  ? 'bg-[#ff6700]/10 text-white'
                  : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]'
              }`}
            >
              <Icon
                size={18}
                className={active ? 'text-[#ff6700]' : 'text-[#555] group-hover:text-[#888]'}
              />
              <span className="flex-1">{item.label}</span>
              {active && (
                <ChevronRight size={14} className="text-[#ff6700]/50" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-[#2a2a2a] p-3">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center shrink-0">
            <span className="text-xs font-medium text-[#999]">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">
              {memberName || 'Team Member'}
            </p>
            <p className="text-xs text-[#555] truncate">{memberEmail}</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-[#666] hover:text-white hover:bg-[#1a1a1a] transition-colors"
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
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-[#141414] border border-[#2a2a2a] rounded-lg flex items-center justify-center text-[#999] hover:text-white transition-colors"
      >
        <Menu size={18} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="w-[260px] h-full bg-[#111] border-r border-[#2a2a2a]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-[#666] hover:text-white"
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[240px] lg:shrink-0 bg-[#111] border-r border-[#2a2a2a] h-screen sticky top-0">
        {sidebarContent}
      </aside>
    </>
  );
}