// components/admin/settings/RolesTab.tsx
'use client';

// Read-only reference table for the team-role permission matrix. Mirrors the
// shape of Filestage's Team → Roles page. Source data lives in
// `lib/permissions.ts` so the tab and code-level gates stay in sync.

import { Check, X, Crown, Shield, User } from 'lucide-react';
import {
  PERMISSION_GROUPS, PERMISSION_MATRIX, ROLE_LABELS, ROLE_DESCRIPTIONS,
  TEAM_ROLES, type TeamRole,
} from '@/lib/permissions';

const ROLE_ICON: Record<TeamRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: User,
};

const ROLE_ICON_CLASS: Record<TeamRole, string> = {
  owner: 'text-teal',
  admin: 'text-teal/70',
  member: 'text-faint',
};

interface RolesTabProps {
  /** The viewer's current role — used to subtly highlight the column. */
  currentRole?: TeamRole | string;
}

export default function RolesTab({ currentRole }: RolesTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-ink">Roles &amp; permissions</h2>
        <p className="text-[13px] text-muted mt-1">
          What each role can do across projects, the team, and company settings. Custom roles aren&apos;t
          available yet — contact us if you need finer-grained access.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted px-5 py-3">
                Permission
              </th>
              {TEAM_ROLES.map((role) => {
                const Icon = ROLE_ICON[role];
                const isCurrent = currentRole === role;
                return (
                  <th
                    key={role}
                    className={`text-center px-4 py-3 ${isCurrent ? 'bg-teal/5' : ''}`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <Icon size={13} className={ROLE_ICON_CLASS[role]} />
                        <span className="text-[13px] font-semibold text-ink">{ROLE_LABELS[role]}</span>
                      </div>
                      <span className="text-[10px] text-muted leading-tight max-w-[160px]">
                        {ROLE_DESCRIPTIONS[role]}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => {
              const rows = PERMISSION_MATRIX.filter((p) => p.group === group.key);
              if (rows.length === 0) return null;
              return (
                <PermissionGroup
                  key={group.key}
                  label={group.label}
                  rows={rows}
                  currentRole={currentRole}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PermissionGroup({
  label, rows, currentRole,
}: {
  label: string;
  rows: typeof PERMISSION_MATRIX;
  currentRole?: TeamRole | string;
}) {
  return (
    <>
      <tr className="bg-surface/60 border-t border-gray-100">
        <td colSpan={TEAM_ROLES.length + 1} className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          {label}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.key} className="border-t border-gray-100">
          <td className="px-5 py-3 align-top">
            <div className="text-[13px] font-medium text-ink">{row.label}</div>
            {row.description && (
              <div className="text-[11px] text-muted mt-0.5">{row.description}</div>
            )}
          </td>
          {TEAM_ROLES.map((role) => {
            const grant = row.grants[role];
            const isCurrent = currentRole === role;
            return (
              <td
                key={role}
                className={`px-4 py-3 text-center align-middle ${isCurrent ? 'bg-teal/5' : ''}`}
              >
                <GrantCell grant={grant} />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function GrantCell({ grant }: { grant: true | false | { partial: string } }) {
  if (grant === true) {
    return <Check size={16} className="text-emerald-500 inline" />;
  }
  if (grant === false) {
    return <X size={16} className="text-gray-300 inline" />;
  }
  return (
    <span className="text-[11px] text-muted leading-snug inline-block max-w-[160px]">
      {grant.partial}
    </span>
  );
}
