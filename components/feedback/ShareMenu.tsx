'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Share2, Copy, Check, ExternalLink, Loader2, ChevronDown,
  GitBranch, Columns3, LayoutGrid, Lock, Calendar, X, Eye, EyeOff,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_SHARED_VIEWS, type FeedbackSharedViews } from '@/lib/types/feedback';

interface ShareMenuProps {
  projectId: string;
  shareToken: string;
  sharedViews: FeedbackSharedViews | null | undefined;
  buildUrl: (token: string) => string;
  onViewsChange: (next: FeedbackSharedViews) => void;
  /** Whether the share link currently has a password set. */
  hasPassword?: boolean;
  /** Current expiry date (ISO string), null = never. */
  expiresAt?: string | null;
  /** Called when password/expiry settings change. */
  onSecurityChange?: (settings: { hasPassword: boolean; expiresAt: string | null }) => void;
}

const TAB_OPTIONS: { key: keyof FeedbackSharedViews; label: string; Icon: typeof GitBranch }[] = [
  { key: 'board', label: 'Whiteboard', Icon: GitBranch },
  { key: 'kanban', label: 'Kanban', Icon: Columns3 },
  { key: 'items', label: 'Items', Icon: LayoutGrid },
];

const EXPIRY_PRESETS: { label: string; days: number | null }[] = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'Never', days: null },
];

/**
 * Project-level share control. Single share link drives a tabbed public
 * viewer at /review/[token]; the toggles below pick which tabs the
 * recipient sees. Toggles are project-wide — every visitor with the link
 * sees the same set.
 */
export default function ShareMenu({
  projectId,
  shareToken,
  sharedViews,
  buildUrl,
  onViewsChange,
  hasPassword = false,
  expiresAt = null,
  onSecurityChange,
}: ShareMenuProps) {
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savingKey, setSavingKey] = useState<keyof FeedbackSharedViews | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Security settings state
  const [passwordEnabled, setPasswordEnabled] = useState(hasPassword);
  const [passwordValue, setPasswordValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [expiryDate, setExpiryDate] = useState<string>(expiresAt ?? '');
  const [savingSecurity, setSavingSecurity] = useState(false);

  // Sync props → local state when props change
  useEffect(() => { setPasswordEnabled(hasPassword); }, [hasPassword]);
  useEffect(() => { setExpiryDate(expiresAt ?? ''); }, [expiresAt]);

  const views = sharedViews ?? DEFAULT_SHARED_VIEWS;
  const url = buildUrl(shareToken);
  const enabledCount = (views.board ? 1 : 0) + (views.kanban ? 1 : 0) + (views.items ? 1 : 0);

  // Track whether the security section has unsaved changes
  const passwordDirty = passwordEnabled !== hasPassword || (passwordEnabled && passwordValue.length > 0);
  const expiryDirty = (expiryDate || null) !== (expiresAt || null);
  const securityDirty = passwordDirty || expiryDirty;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const copyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Share link copied!');
    } catch {
      toast.error('Failed to copy link');
    }
  }, [url, toast]);

  const toggleView = useCallback(async (key: keyof FeedbackSharedViews) => {
    const next: FeedbackSharedViews = { ...views, [key]: !views[key] };
    if (!next.board && !next.kanban && !next.items) {
      toast.error('At least one view must stay shared');
      return;
    }
    setSavingKey(key);
    try {
      const { data: session } = await supabase.auth.getSession();
      const authToken = session.session?.access_token;
      if (!authToken) { toast.error('Not authenticated'); return; }

      const res = await fetch(`/api/reviews/${projectId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ shared_views: next }),
      });

      if (!res.ok) { toast.error('Failed to update'); return; }

      const data = await res.json();
      onViewsChange(data.shared_views as FeedbackSharedViews);
    } catch {
      toast.error('Failed to update');
    } finally {
      setSavingKey(null);
    }
  }, [views, projectId, onViewsChange, toast]);

  const saveSecurity = useCallback(async () => {
    setSavingSecurity(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const authToken = session.session?.access_token;
      if (!authToken) { toast.error('Not authenticated'); return; }

      const body: Record<string, unknown> = {};

      // Password: if toggling off, send null. If toggling on or updating, send the new password.
      if (!passwordEnabled) {
        body.share_password = null;
      } else if (passwordValue.trim()) {
        body.share_password = passwordValue.trim();
      }
      // If password was already enabled and no new value typed, don't send password field
      // (keep existing hash on the server)

      // Expiry
      body.share_expires_at = expiryDate ? new Date(expiryDate + 'T23:59:59').toISOString() : null;

      const res = await fetch(`/api/reviews/${projectId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        toast.error('Failed to update link settings');
        return;
      }

      const data = await res.json();
      setPasswordValue('');
      toast.success('Link settings updated');
      onSecurityChange?.({
        hasPassword: data.has_password ?? passwordEnabled,
        expiresAt: data.share_expires_at ?? (expiryDate || null),
      });
    } catch {
      toast.error('Failed to update link settings');
    } finally {
      setSavingSecurity(false);
    }
  }, [passwordEnabled, passwordValue, expiryDate, projectId, toast, onSecurityChange]);

  const applyPreset = (days: number | null) => {
    if (days === null) {
      setExpiryDate('');
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + days);
    setExpiryDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="relative inline-flex" ref={menuRef}>
      <button
        onClick={copyUrl}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-l-lg border-r-0 transition-colors text-teal border-teal/30 bg-teal/5 hover:bg-teal/10"
      >
        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      <button
        onClick={() => setMenuOpen((s) => !s)}
        className="flex items-center px-1.5 py-2 rounded-r-lg border border-teal/30 bg-teal/5 hover:bg-teal/10 text-teal transition-colors"
        title="Sharing settings"
      >
        <ChevronDown size={12} />
      </button>

      {menuOpen && (
        <div
          className="fixed z-50 bg-white rounded-2xl border border-edge-strong shadow-lg w-[320px] py-2 max-h-[calc(100vh-80px)] overflow-y-auto"
          style={{
            top: (menuRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
            left: Math.min(
              menuRef.current?.getBoundingClientRect().right ?? 0,
              window.innerWidth - 330
            ) - 320,
          }}
        >
          {/* Tabs visible to reviewers */}
          <div className="px-3 pt-1 pb-2">
            <p className="text-detail uppercase tracking-wide font-semibold text-faint">
              Tabs visible to reviewers
            </p>
            <p className="text-detail text-faint mt-0.5">
              {enabledCount} of 3 enabled
            </p>
          </div>

          {TAB_OPTIONS.map(({ key, label, Icon }) => {
            const checked = views[key];
            const saving = savingKey === key;
            return (
              <button
                key={key}
                onClick={() => toggleView(key)}
                disabled={saving}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-prose hover:bg-surface transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Icon size={14} className={checked ? 'text-teal' : 'text-faint'} />
                  {label}
                </span>
                {saving ? (
                  <Loader2 size={14} className="animate-spin text-faint" />
                ) : (
                  <span
                    className={`relative w-8 h-[18px] rounded-full transition-colors ${
                      checked ? 'bg-teal' : 'bg-edge'
                    }`}
                  >
                    <span
                      className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-all ${
                        checked ? 'left-[16px]' : 'left-[2px]'
                      }`}
                    />
                  </span>
                )}
              </button>
            );
          })}

          {/* ── Link security section ── */}
          <div className="border-t border-edge my-1.5" />

          <div className="px-3 pt-2 pb-1.5">
            <p className="text-detail uppercase tracking-wide font-semibold text-faint">
              Link security
            </p>
          </div>

          {/* Password toggle */}
          <div className="px-3 py-2">
            <button
              onClick={() => {
                setPasswordEnabled((p) => !p);
                if (passwordEnabled) setPasswordValue('');
              }}
              className="w-full flex items-center justify-between gap-3 text-sm text-prose"
            >
              <span className="flex items-center gap-2">
                <Lock size={14} className={passwordEnabled ? 'text-teal' : 'text-faint'} />
                Require password
              </span>
              <span
                className={`relative w-8 h-[18px] rounded-full transition-colors ${
                  passwordEnabled ? 'bg-teal' : 'bg-edge'
                }`}
              >
                <span
                  className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-all ${
                    passwordEnabled ? 'left-[16px]' : 'left-[2px]'
                  }`}
                />
              </span>
            </button>

            {passwordEnabled && (
              <div className="mt-2 relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordValue}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  placeholder={hasPassword ? 'Enter new password to change' : 'Set a password'}
                  className="w-full px-3 py-2 pr-9 rounded-xl bg-surface border border-edge-strong text-sm text-ink outline-none focus:border-edge-hover focus:ring-2 focus:ring-teal/15"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-dim transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            )}
          </div>

          {/* Expiry date */}
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-prose mb-2">
              <Calendar size={14} className={expiryDate ? 'text-teal' : 'text-faint'} />
              <span>Expires on</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="flex-1 px-3 py-2 rounded-xl bg-surface border border-edge-strong text-sm text-ink outline-none focus:border-edge-hover focus:ring-2 focus:ring-teal/15"
              />
              {expiryDate && (
                <button
                  onClick={() => setExpiryDate('')}
                  className="p-1.5 rounded-lg text-faint hover:text-dim hover:bg-surface transition-colors"
                  title="Remove expiry"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex gap-1.5 mt-2">
              {EXPIRY_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset.days)}
                  className={`px-2 py-1 rounded-lg text-detail font-medium transition-colors ${
                    (preset.days === null && !expiryDate) ||
                    (preset.days !== null && expiryDate === (() => {
                      const d = new Date();
                      d.setDate(d.getDate() + preset.days);
                      return d.toISOString().split('T')[0];
                    })())
                      ? 'bg-teal/10 text-teal'
                      : 'bg-surface text-dim hover:bg-surface'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Save button for security settings */}
          {securityDirty && (
            <div className="px-3 py-2">
              <button
                onClick={saveSecurity}
                disabled={savingSecurity || (passwordEnabled && !hasPassword && !passwordValue.trim())}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-teal hover:bg-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingSecurity ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                {savingSecurity ? 'Saving...' : 'Save link settings'}
              </button>
            </div>
          )}

          <div className="border-t border-edge my-1.5" />

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-prose hover:bg-surface transition-colors"
          >
            <ExternalLink size={14} />
            Open Preview
          </a>
          <button
            onClick={async () => { await copyUrl(); setMenuOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-prose hover:bg-surface transition-colors"
          >
            <Share2 size={14} />
            Copy share link
          </button>
        </div>
      )}
    </div>
  );
}
