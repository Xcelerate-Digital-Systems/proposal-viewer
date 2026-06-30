'use client';

import {
  Check, ChevronRight, X, Bell, Layers, Send, RotateCcw,
} from 'lucide-react';
import type { FeedbackStatus } from '@/lib/types/feedback';
import { PREF_DEFS, ALL_PREF_KEYS } from './assignee-types';
import type { Guest, PrefKey } from './assignee-types';
import AssigneeAvatar from './AssigneeAvatar';
import StagesChipRow from './StagesChipRow';

export default function GuestRow({
  guest: g,
  isExpanded,
  onToggleExpand,
  onTogglePref,
  onToggleAllPrefs,
  onToggleStage,
  onResetStages,
  onSetRemoved,
  onResendInvite,
  resending,
  savedKeys,
}: {
  guest: Guest;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTogglePref: (email: string, key: PrefKey) => void;
  onToggleAllPrefs: (email: string, allOn: boolean) => void;
  onToggleStage: (email: string, stage: FeedbackStatus) => void;
  onResetStages: (email: string) => void;
  onSetRemoved: (email: string, removed: boolean) => void;
  onResendInvite: (email: string, name: string) => void;
  resending: boolean;
  savedKeys: Set<string>;
}) {
  if (g.removed) {
    return (
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 opacity-50">
        <div className="flex items-center gap-2.5 min-w-0">
          <AssigneeAvatar name={g.name || ''} email={g.email} seed={g.email} size={24} />
          <div className="min-w-0">
            <p className="text-caption text-ink truncate">{g.name || g.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSetRemoved(g.email, false)}
          className="text-xs text-faint hover:text-teal transition-colors flex items-center gap-1 shrink-0"
        >
          <RotateCcw size={14} />
          Restore
        </button>
      </div>
    );
  }

  const prefCount = ALL_PREF_KEYS.filter((k) => g.prefs[k]).length;
  const stageCount = g.stages.length;

  return (
    <div>
      {/* Collapsed header */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-surface/50 transition-colors"
        aria-expanded={isExpanded}
      >
        <AssigneeAvatar name={g.name || ''} email={g.email} seed={g.email} size={28} />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-medium text-ink truncate">{g.name || g.email}</p>
          <p className="text-xs text-faint truncate">{g.email}</p>
        </div>

        {!isExpanded && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-medium bg-surface text-dim">
              <Bell size={9} />
              {prefCount}/{ALL_PREF_KEYS.length}
            </span>
            {stageCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-medium bg-surface text-dim">
                <Layers size={9} />
                {stageCount}
              </span>
            )}
          </div>
        )}

        <ChevronRight
          size={14}
          className={`text-faint shrink-0 transition-transform duration-150 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-4 pb-3">
          {/* Notification prefs */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-detail font-medium text-dim">Notifications</span>
            <span className="text-detail text-faint">·</span>
            <button
              type="button"
              onClick={() => onToggleAllPrefs(g.email, true)}
              className="text-detail text-teal hover:text-teal/80 transition-colors"
            >
              All on
            </button>
            <button
              type="button"
              onClick={() => onToggleAllPrefs(g.email, false)}
              className="text-detail text-faint hover:text-prose transition-colors"
            >
              All off
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PREF_DEFS.map((p) => {
              const Icon = p.icon;
              const on = g.prefs[p.key];
              const justSaved = savedKeys.has(`gpref-${g.email}-${p.key}`);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => onTogglePref(g.email, p.key)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-detail font-medium transition-colors ${
                    on
                      ? 'bg-teal/10 text-teal'
                      : 'bg-surface text-faint hover:text-prose'
                  }`}
                  title={`${on ? 'On' : 'Off'} — ${p.label}`}
                >
                  {justSaved ? <Check size={11} className="text-emerald-500" /> : <Icon size={11} />}
                  {p.label}
                </button>
              );
            })}
          </div>

          <StagesChipRow
            selected={g.stages}
            onToggle={(stage) => onToggleStage(g.email, stage)}
            onReset={() => onResetStages(g.email)}
            audience="guest"
            savedKeys={savedKeys}
            savedPrefix={`gstage-${g.email}`}
          />

          <div className="mt-3 flex items-center justify-between">
            {!g.removed && (
              <button
                type="button"
                onClick={() => onResendInvite(g.email, g.name)}
                disabled={resending}
                className="text-xs text-faint hover:text-teal transition-colors flex items-center gap-1 disabled:opacity-50"
                title="Resend invite email"
              >
                {resending ? (
                  <div className="w-3 h-3 border-2 border-edge-hover border-t-teal rounded-full animate-spin" />
                ) : (
                  <Send size={12} />
                )}
                Resend invite
              </button>
            )}
            <button
              type="button"
              onClick={() => onSetRemoved(g.email, true)}
              className="text-xs text-faint hover:text-red-500 transition-colors flex items-center gap-1 ml-auto"
            >
              <X size={14} />
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
