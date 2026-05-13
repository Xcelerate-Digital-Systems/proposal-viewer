'use client';

import { Mail } from 'lucide-react';
import { type NodeItemProps, IconShell } from './nodeConfig';

export default function EmailNode(props: NodeItemProps) {
  return (
    <IconShell
      {...props}
      icon={<Mail size={32} strokeWidth={1.8} className="text-white" />}
      label="Email"
      tint="#EF4444"
      solid
    />
  );
}
