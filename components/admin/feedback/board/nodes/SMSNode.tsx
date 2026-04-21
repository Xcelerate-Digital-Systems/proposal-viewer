'use client';

import { Smartphone } from 'lucide-react';
import { type NodeItemProps, IconShell } from './nodeConfig';

export default function SMSNode(props: NodeItemProps) {
  return (
    <IconShell
      {...props}
      icon={<Smartphone size={30} strokeWidth={1.5} />}
      label="SMS"
      tint="#D1F0C8"
    />
  );
}
