'use client';

import { MessageSquare } from 'lucide-react';
import { type NodeItemProps, IconShell } from './nodeConfig';

export default function SMSNode(props: NodeItemProps) {
  return (
    <IconShell
      {...props}
      icon={<MessageSquare size={40} strokeWidth={1.8} className="text-white" />}
      label="SMS"
      tint="#10B981"
      solid
    />
  );
}
