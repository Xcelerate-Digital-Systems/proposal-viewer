'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, type FunnelRole } from '@/lib/supabase';
import { defaultRoleColor } from '@/lib/types/funnel';
import { useToast } from '@/components/ui/Toast';

/**
 * The company's role library.
 *
 * Roles are company-scoped, not funnel-scoped: typing "Account Manager" once
 * on any funnel makes it available on every other funnel and pipeline. They
 * are plain labels — nothing here touches team_members or auth users, and
 * assigning one never invites anybody to the account.
 */
export function useFunnelRoles(companyId: string) {
  const toast = useToast();
  const [roles, setRoles] = useState<FunnelRole[]>([]);

  const loadRoles = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('funnel_roles').select('*').eq('company_id', companyId).order('name');
    setRoles(data || []);
  }, [companyId]);

  useEffect(() => { void loadRoles(); }, [loadRoles]);

  /** Find-or-create by name, case-insensitively. Returns the role either way,
   *  so the caller can assign it immediately. */
  const ensureRole = useCallback(async (rawName: string): Promise<FunnelRole | null> => {
    const name = rawName.trim();
    if (!name) return null;

    const existing = roles.find((r) => r.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    const { data, error } = await supabase
      .from('funnel_roles')
      .insert({ company_id: companyId, name, color: defaultRoleColor(name) })
      .select().single();

    if (error) {
      // A unique-violation means someone else created it between our check and
      // the insert — re-read rather than surfacing an error.
      if (error.code === '23505') {
        const { data: found } = await supabase
          .from('funnel_roles').select('*')
          .eq('company_id', companyId).ilike('name', name).maybeSingle();
        if (found) {
          setRoles((prev) => prev.some((r) => r.id === found.id) ? prev : [...prev, found]);
          return found;
        }
      }
      toast.error('Failed to create role');
      return null;
    }

    if (data) setRoles((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  }, [companyId, roles, toast]);

  const updateRole = useCallback(async (id: string, patch: Partial<FunnelRole>) => {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase
      .from('funnel_roles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Failed to update role'); void loadRoles(); }
  }, [toast, loadRoles]);

  /** Removing a role from the library clears it off every node that used it —
   *  role_id is ON DELETE SET NULL, so no node is lost. */
  const deleteRole = useCallback(async (id: string) => {
    setRoles((prev) => prev.filter((r) => r.id !== id));
    const { error } = await supabase.from('funnel_roles').delete().eq('id', id);
    if (error) { toast.error('Failed to delete role'); void loadRoles(); }
  }, [toast, loadRoles]);

  return { roles, ensureRole, updateRole, deleteRole, reloadRoles: loadRoles };
}
