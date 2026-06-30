'use client';

import { createPortal } from 'react-dom';
import {
  Check, ChevronDown, ChevronRight, X,
  Bell, Layers, UserPlus, Users,
} from 'lucide-react';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';
import { PREF_DEFS, ALL_PREF_KEYS } from './assignees/assignee-types';
import AssigneeAvatar from './assignees/AssigneeAvatar';
import GuestRow from './assignees/GuestRow';
import StagesChipRow from './assignees/StagesChipRow';
import useProjectAssignees from './assignees/useProjectAssignees';

export default function ProjectAssigneesPanel({
  projectId,
  companyId,
  currentUserId,
}: {
  projectId: string;
  companyId: string;
  currentUserId: string | null;
}) {
  const h = useProjectAssignees(projectId, companyId, currentUserId);

  if (h.loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-5 h-5 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* ── Team Members column ─────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Users size={15} className="text-faint" />
          <h3 className="text-sm font-semibold text-ink">Team Members</h3>
        </div>
        <p className="text-caption text-dim mb-4">
          Assigned team members receive email alerts for activity on this project.
          Click a row to configure notifications and stages.
        </p>

        <div className="border border-edge rounded-2xl bg-white divide-y divide-edge">
          {h.assignedMembers.length === 0 ? (
            <div className="px-4 py-6 text-caption text-faint text-center">
              No one is assigned yet. Add a team member below.
            </div>
          ) : (
            h.assignedMembers.map((m) => {
              const isSelf = h.ownTeamMember?.id === m.id;
              const a = h.assignedById.get(m.id)!;
              const isExpanded = h.expandedIds.has(m.id);
              const prefCount = ALL_PREF_KEYS.filter((k) => a[k]).length;
              const stageCount = a.stages.length;

              return (
                <div key={m.id} className="group">
                  <button
                    type="button"
                    onClick={() => h.toggleExpanded(m.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-surface/50 transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <AssigneeAvatar name={m.name || ''} email={m.email} seed={m.id} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="text-caption font-medium text-ink truncate">
                        {m.name || m.email}
                        {isSelf && <span className="ml-2 text-xs text-faint">(you)</span>}
                      </p>
                      <p className="text-xs text-faint truncate">{m.email}</p>
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

                  {isExpanded && (
                    <div className="px-4 pb-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-detail font-medium text-dim">Notifications</span>
                        <span className="text-detail text-faint">·</span>
                        <button
                          type="button"
                          onClick={() => h.toggleAllPrefs(m.id, true)}
                          className="text-detail text-teal hover:text-teal/80 transition-colors"
                        >
                          All on
                        </button>
                        <button
                          type="button"
                          onClick={() => h.toggleAllPrefs(m.id, false)}
                          className="text-detail text-faint hover:text-prose transition-colors"
                        >
                          All off
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {PREF_DEFS.map((p) => {
                          const Icon = p.icon;
                          const on = a[p.key];
                          const justSaved = h.savedKeys.has(`pref-${m.id}-${p.key}`);
                          return (
                            <button
                              key={p.key}
                              type="button"
                              onClick={() => h.togglePref(m.id, p.key)}
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
                        selected={a.stages}
                        onToggle={(stage) => h.toggleMemberStage(m.id, stage)}
                        onReset={() => h.resetMemberStages(m.id)}
                        savedKeys={h.savedKeys}
                        savedPrefix={`stage-${m.id}`}
                      />

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => h.remove(m.id)}
                          disabled={h.savingFor === m.id}
                          className="text-xs text-faint hover:text-red-500 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <X size={14} />
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="relative mt-3">
          <button
            ref={h.pickerBtnRef}
            type="button"
            onClick={h.openPicker}
            disabled={h.unassignedMembers.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium border border-edge-strong rounded-full hover:border-edge-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add team member
            <ChevronDown size={14} />
          </button>

          {h.pickerOpen && h.unassignedMembers.length > 0 && h.pickerPos && createPortal(
            <>
              <div className="fixed inset-0 z-40" onClick={h.closePicker} />
              <div
                className="fixed z-50 w-64 bg-white border border-edge rounded-2xl shadow-lg py-1 max-h-72 overflow-y-auto"
                style={{ top: h.pickerPos.top, left: h.pickerPos.left }}
              >
                {h.unassignedMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => h.add(m.id)}
                    disabled={h.savingFor === m.id}
                    className="w-full text-left px-3 py-2 hover:bg-surface flex items-center gap-2.5"
                  >
                    <AssigneeAvatar name={m.name || ''} email={m.email} seed={m.id} />
                    <div className="min-w-0 flex-1">
                      <p className="text-caption text-ink truncate">{m.name || m.email}</p>
                      <p className="text-xs text-faint truncate">{m.email}</p>
                    </div>
                    {h.savingFor === m.id && (
                      <Check size={14} className="text-teal shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )}
        </div>
      </section>

      {/* ── Guests column ───────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Bell size={15} className="text-faint" />
          <h3 className="text-sm font-semibold text-ink">Guests</h3>
        </div>
        <p className="text-caption text-dim mb-4">
          Clients and outside reviewers. They appear automatically when they comment,
          or you can add them manually below.
        </p>

        <div className="border border-edge rounded-2xl bg-white divide-y divide-edge">
          {h.activeGuests.length === 0 && h.removedGuests.length === 0 ? (
            <div className="px-4 py-6 text-caption text-faint text-center">
              No guests yet. Add one manually or they&apos;ll appear when they leave a comment.
            </div>
          ) : (
            <>
              {h.activeGuests.map((g) => (
                <GuestRow
                  key={g.email}
                  guest={g}
                  isExpanded={h.expandedIds.has(g.email)}
                  onToggleExpand={() => h.toggleExpanded(g.email)}
                  onTogglePref={h.toggleGuestPref}
                  onToggleAllPrefs={h.toggleAllGuestPrefs}
                  onToggleStage={h.toggleGuestStage}
                  onResetStages={h.resetGuestStages}
                  onSetRemoved={h.setGuestRemoved}
                  onResendInvite={h.resendInvite}
                  resending={h.resending === g.email}
                  savedKeys={h.savedKeys}
                />
              ))}

              {h.removedGuests.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => h.setShowRemoved(!h.showRemoved)}
                    className="w-full px-4 py-2 text-detail text-faint hover:text-prose transition-colors text-center"
                  >
                    {h.showRemoved ? 'Hide' : 'Show'} {h.removedGuests.length} removed guest{h.removedGuests.length !== 1 ? 's' : ''}
                  </button>
                  {h.showRemoved &&
                    h.removedGuests.map((g) => (
                      <GuestRow
                        key={g.email}
                        guest={g}
                        isExpanded={false}
                        onToggleExpand={() => {}}
                        onTogglePref={h.toggleGuestPref}
                        onToggleAllPrefs={h.toggleAllGuestPrefs}
                        onToggleStage={h.toggleGuestStage}
                        onResetStages={h.resetGuestStages}
                        onSetRemoved={h.setGuestRemoved}
                        onResendInvite={h.resendInvite}
                        resending={h.resending === g.email}
                        savedKeys={h.savedKeys}
                      />
                    ))}
                </>
              )}
            </>
          )}
        </div>

        <div className="mt-3">
          {h.guestFormOpen ? (
            <div className="border border-edge-strong rounded-2xl bg-white p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-detail font-medium text-dim mb-1">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <ContactAutocomplete
                    value={h.guestEmail}
                    onChange={h.setGuestEmail}
                    onSelect={(c) => {
                      h.setGuestEmail(c.email);
                      if (c.name && !h.guestName) h.setGuestName(c.name);
                    }}
                    placeholder="guest@example.com"
                    autoFocus
                    className="w-full px-3 py-1.5 text-caption border border-edge-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                  />
                </div>
                <div>
                  <label className="block text-detail font-medium text-dim mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={h.guestName}
                    onChange={(e) => h.setGuestName(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-1.5 text-caption border border-edge-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') h.addGuest();
                    }}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={h.guestSendInvite}
                  onChange={(e) => h.setGuestSendInvite(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-edge-strong text-teal focus:ring-teal/30 accent-teal"
                />
                <span className="text-detail text-dim">Send invite email with review link</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={h.addGuest}
                  disabled={h.guestSaving || !h.guestEmail.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium bg-teal text-white rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50"
                >
                  {h.guestSaving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <UserPlus size={14} />
                  )}
                  Add Guest
                </button>
                <button
                  type="button"
                  onClick={() => {
                    h.setGuestFormOpen(false);
                    h.setGuestEmail('');
                    h.setGuestName('');
                    h.setGuestSendInvite(true);
                  }}
                  className="px-3 py-1.5 text-caption font-medium text-dim hover:text-prose transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => h.setGuestFormOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium border border-edge-strong rounded-full hover:border-edge-hover transition-colors"
            >
              <UserPlus size={14} />
              Add guest
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
