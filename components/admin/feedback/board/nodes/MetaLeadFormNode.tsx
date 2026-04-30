'use client';

import { ClipboardList } from 'lucide-react';
import { type NodeItemProps, IconShell } from './nodeConfig';

export default function MetaLeadFormNode(props: NodeItemProps) {
  return (
    <IconShell
      {...props}
      icon={<ClipboardList size={32} className="text-[#1877F2]" strokeWidth={1.8} />}
      label="Lead Form"
      tint="#DBEAFE"
    />
  );
}
