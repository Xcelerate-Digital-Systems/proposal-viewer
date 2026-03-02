// components/admin/documents/DocumentCoverEditor.tsx
'use client';

import { Document } from '@/lib/supabase';
import CoverEditor from '@/components/admin/shared/CoverEditor';

interface DocumentCoverEditorProps {
  document: Document;
  onSave: () => void;
  onCancel: () => void;
}

export default function DocumentCoverEditor({ document: doc, onSave, onCancel }: DocumentCoverEditorProps) {
  return <CoverEditor type="document" entity={doc} onSave={onSave} onCancel={onCancel} />;
}