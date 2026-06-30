// components/admin/company/useCompanySettingsTypes.ts
import { CompanyData } from '@/lib/company-utils';
import { supabase } from '@/lib/supabase';

export interface CompanySettingsContext {
  companyId: string;
  company: CompanyData | null;
  isOwner: boolean;
  saving: string | null;
  setSaving: (s: string | null) => void;
  showFeedback: (msg: string, isError?: boolean) => void;
  setCompany: (updater: (prev: CompanyData | null) => CompanyData | null) => void;
}

export async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { 'Authorization': `Bearer ${session?.access_token}` };
}
