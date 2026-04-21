'use client';

import { Mail } from 'lucide-react';
import { type NodeItemProps, IconShell } from './nodeConfig';

export default function EmailNode(props: NodeItemProps) {
  return (
    <IconShell
      {...props}
      icon={<Mail size={30} strokeWidth={1.5} />}
      label="Email"
      tint="#EDE9FE"
    />
  );
}
