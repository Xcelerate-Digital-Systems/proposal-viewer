// components/admin/company/useCompanyDecisionDesign.ts
'use client';

import { useState, useEffect } from 'react';
import { CompanySettingsContext, getAuthHeaders } from './useCompanySettingsTypes';

export function useCompanyDecisionDesign(ctx: CompanySettingsContext) {
  const { companyId, company, isOwner, setSaving, showFeedback, setCompany } = ctx;

  const [decisionBgColor, setDecisionBgColor]                     = useState<string | null>(null);
  const [decisionTextColor, setDecisionTextColor]                 = useState<string | null>(null);
  const [decisionHeadingColor, setDecisionHeadingColor]           = useState<string | null>(null);
  const [decisionAcceptButtonColor, setDecisionAcceptButtonColor] = useState<string | null>(null);
  const [decisionDeclineButtonColor, setDecisionDeclineButtonColor] = useState<string | null>(null);
  const [decisionRevisionButtonColor, setDecisionRevisionButtonColor] = useState<string | null>(null);
  const [decisionCheckboxColor, setDecisionCheckboxColor]         = useState<string | null>(null);
  const [decisionDesignSaved, setDecisionDesignSaved]             = useState(false);

  // Sync from fetched company
  useEffect(() => {
    if (!company) return;
    setDecisionBgColor(company.decision_action_bg_color || null);
    setDecisionTextColor(company.decision_action_text_color || null);
    setDecisionHeadingColor(company.decision_action_heading_color || null);
    setDecisionAcceptButtonColor(company.decision_action_accent_color || null);
    setDecisionDeclineButtonColor(company.decision_decline_button_color || null);
    setDecisionRevisionButtonColor(company.decision_revision_button_color || null);
    setDecisionCheckboxColor(company.decision_checkbox_color || null);
  }, [company]);

  const handleSaveDecisionDesign = async () => {
    if (!isOwner) return;
    setSaving('decision_design');
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/company?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision_action_bg_color: decisionBgColor,
        decision_action_text_color: decisionTextColor,
        decision_action_heading_color: decisionHeadingColor,
        decision_action_accent_color: decisionAcceptButtonColor,
        decision_decline_button_color: decisionDeclineButtonColor,
        decision_revision_button_color: decisionRevisionButtonColor,
        decision_checkbox_color: decisionCheckboxColor,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showFeedback(data.error || 'Failed to save', true);
    } else {
      setCompany(prev => prev ? { ...prev, ...data } : prev);
      setDecisionDesignSaved(true);
      setTimeout(() => setDecisionDesignSaved(false), 2000);
    }
    setSaving(null);
  };

  const decisionDesignChanged =
    (decisionBgColor || null) !== (company?.decision_action_bg_color || null) ||
    (decisionTextColor || null) !== (company?.decision_action_text_color || null) ||
    (decisionHeadingColor || null) !== (company?.decision_action_heading_color || null) ||
    (decisionAcceptButtonColor || null) !== (company?.decision_action_accent_color || null) ||
    (decisionDeclineButtonColor || null) !== (company?.decision_decline_button_color || null) ||
    (decisionRevisionButtonColor || null) !== (company?.decision_revision_button_color || null) ||
    (decisionCheckboxColor || null) !== (company?.decision_checkbox_color || null);

  useEffect(() => {
    if (!decisionDesignChanged || !isOwner || !company) return;
    const timer = setTimeout(() => handleSaveDecisionDesign(), 800);
    return () => clearTimeout(timer);
  }, [decisionBgColor, decisionTextColor, decisionHeadingColor, decisionAcceptButtonColor, decisionDeclineButtonColor, decisionRevisionButtonColor, decisionCheckboxColor]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    decisionBgColor, setDecisionBgColor,
    decisionTextColor, setDecisionTextColor,
    decisionHeadingColor, setDecisionHeadingColor,
    decisionAcceptButtonColor, setDecisionAcceptButtonColor,
    decisionDeclineButtonColor, setDecisionDeclineButtonColor,
    decisionRevisionButtonColor, setDecisionRevisionButtonColor,
    decisionCheckboxColor, setDecisionCheckboxColor,
    decisionDesignChanged,
    decisionDesignSaved,
  };
}
