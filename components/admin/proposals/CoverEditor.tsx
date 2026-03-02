// components/admin/proposals/CoverEditor.tsx
'use client';

import { Proposal } from '@/lib/supabase';
import CoverEditor from '@/components/admin/shared/CoverEditor';

interface ProposalCoverEditorProps {
  proposal: Proposal;
  onSave?: () => void;
  onCancel?: () => void;
}

export default function ProposalCoverEditor({ proposal, onSave, onCancel }: ProposalCoverEditorProps) {
  return <CoverEditor type="proposal" entity={proposal} onSave={onSave} onCancel={onCancel} />;
}