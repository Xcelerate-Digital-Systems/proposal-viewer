// components/admin/proposals/CoverEditor.tsx
'use client';

import { Proposal } from '@/lib/supabase';
import CoverEditor from '@/components/admin/shared/CoverEditor';

interface ProposalCoverEditorProps {
  proposal: Proposal;
  onSave?: () => void;
  onCancel?: () => void;
  hideColors?: boolean;
  hideEnableToggle?: boolean;
  panelOnly?: boolean;
  contentOnly?: boolean;
}

export default function ProposalCoverEditor({
  proposal,
  onSave,
  onCancel,
  hideColors,
  hideEnableToggle,
  panelOnly,
  contentOnly,
}: ProposalCoverEditorProps) {
  return (
    <CoverEditor
      type="proposal"
      entity={proposal}
      onSave={onSave}
      onCancel={onCancel}
      hideColors={hideColors}
      hideEnableToggle={hideEnableToggle}
      panelOnly={panelOnly}
      contentOnly={contentOnly}
    />
  );
}