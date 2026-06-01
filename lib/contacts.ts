// lib/contacts.ts — server-side contact upsert helper
import type { SupabaseClient } from '@supabase/supabase-js';

export async function upsertContact(
  supabase: SupabaseClient,
  companyId: string,
  contact: {
    email: string;
    name?: string | null;
    organisation?: string | null;
    phone?: string | null;
    source?: string;
  },
) {
  const email = contact.email.trim().toLowerCase();
  if (!email) return;

  try {
    await supabase.from('contacts').upsert(
      {
        company_id: companyId,
        email,
        name: contact.name?.trim() || null,
        organisation: contact.organisation?.trim() || null,
        phone: contact.phone?.trim() || null,
        source: contact.source ?? 'manual',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,email', ignoreDuplicates: false }
    );
  } catch {
    // Non-critical — don't let contact sync break the parent operation
  }
}
