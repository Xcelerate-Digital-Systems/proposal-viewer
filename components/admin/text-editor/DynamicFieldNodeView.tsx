// components/admin/text-editor/DynamicFieldNodeView.tsx
'use client';

import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { DYNAMIC_FIELDS } from './DynamicFieldExtension';

export default function DynamicFieldNodeView({ node }: NodeViewProps) {
  const field = node.attrs.field as string;
  const fieldDef = DYNAMIC_FIELDS.find((f) => f.field === field);
  const label = fieldDef?.label || field;

  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-[#017C87]/10 text-[#017C87] border border-[#017C87]/20 cursor-default select-none whitespace-nowrap align-baseline"
        contentEditable={false}
        title={fieldDef?.description}
      >
        <span className="text-[10px] opacity-60">{'{'}</span>
        {label}
        <span className="text-[10px] opacity-60">{'}'}</span>
      </span>
    </NodeViewWrapper>
  );
}