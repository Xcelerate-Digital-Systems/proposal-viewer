// components/admin/settings/RolesTab.tsx
'use client';

import { Check, X, Crown, Shield, User, Eye, MessageSquare } from 'lucide-react';
import {
  PERMISSION_GROUPS, PERMISSION_MATRIX, ROLE_LABELS, ROLE_DESCRIPTIONS,
  ROLE_CATEGORIES, ALL_ROLES, type AnyRole,
} from '@/lib/permissions';

const ROLE_ICON: Record<AnyRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: User,
  client: Eye,
  guest: MessageSquare,
};

const ROLE_ICON_CLASS: Record<AnyRole, string> = {
  owner: 'text-teal',
  admin: 'text-teal/70',
  member: 'text-faint',
  client: 'text-blue-500',
  guest: 'text-violet-500',
};

interface RolesTabProps {
  currentRole?: AnyRole | string;
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

      <div className="flex gap-3 flex-wrap">
        {ROLE_CATEGORIES.map((cat) => (
          <div key={cat.key} className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">{cat.label}</span>
            <div className="flex gap-1.5">
              {cat.roles.map((role) => {
                const Icon = ROLE_ICON[role];
                return (
                  <span
                    key={role}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium ${
                      role === currentRole
                        ? 'bg-teal/10 text-teal ring-1 ring-teal/20'
                        : 'bg-surface text-muted'
                    }`}
                  >
                    <Icon size={11} className={ROLE_ICON_CLASS[role]} />
                    {ROLE_LABELS[role]}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-edge overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted px-5 py-3 w-[240px]">
                Permission
              </th>
              {ROLE_CATEGORIES.map((cat) => (
                <th
                  key={cat.key}
                  colSpan={cat.roles.length}
                  className="text-center px-2 py-1.5 border-l border-gray-100 first:border-l-0"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                    {cat.label}
                  </span>
                </th>
              ))}
            </tr>
            <tr className="border-b border-gray-100">
              <th />
              {ALL_ROLES.map((role) => {
                const Icon = ROLE_ICON[role];
                const isCurrent = currentRole === role;
                return (
                  <th
                    key={role}
                    className={`text-center px-3 py-3 ${isCurrent ? 'bg-teal/5' : ''}`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="flex items-center gap-1">
                        <Icon size={12} className={ROLE_ICON_CLASS[role]} />
                        <span className="text-[12px] font-semibold text-ink">{ROLE_LABELS[role]}</span>
                      </div>
                      <span className="text-[10px] text-muted leading-tight max-w-[120px]">
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
  currentRole?: AnyRole | string;
}) {
  return (
    <>
      <tr className="bg-surface/60 border-t border-gray-100">
        <td colSpan={ALL_ROLES.length + 1} className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          {label}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.key} className="border-t border-gray-100 hover:bg-surface/30 transition-colors">
          <td className="px-5 py-3 align-top">
            <div className="text-[13px] font-medium text-ink">{row.label}</div>
            {row.description && (
              <div className="text-[11px] text-muted mt-0.5">{row.description}</div>
            )}
          </td>
          {ALL_ROLES.map((role) => {
            const grant = row.grants[role];
            const isCurrent = currentRole === role;
            return (
              <td
                key={role}
                className={`px-3 py-3 text-center align-middle ${isCurrent ? 'bg-teal/5' : ''}`}
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
    <span className="text-[10px] text-muted leading-snug inline-block max-w-[120px]">
      {grant.partial}
    </span>
  );
}
