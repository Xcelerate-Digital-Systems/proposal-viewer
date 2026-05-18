// components/admin/templates/TemplateCoverEditor.tsx
'use client';

import { ProposalTemplate } from '@/lib/supabase';
import CoverEditor from '@/components/admin/shared/CoverEditor';

interface TemplateCoverEditorProps {
  template: ProposalTemplate;
  onSave?: () => void;
  onCancel?: () => void;
  contentOnly?: boolean;
}

export default function TemplateCoverEditor({ template, onSave, onCancel, contentOnly }: TemplateCoverEditorProps) {
  return (
    <CoverEditor
      type="template"
      entity={template}
      onSave={onSave}
      onCancel={onCancel}
      contentOnly={contentOnly}
    />
  );
}
