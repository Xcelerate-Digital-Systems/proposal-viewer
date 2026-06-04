'use client';

import { type NodeItemProps, IconShell, FacebookLogo } from './nodeConfig';

export default function FacebookNode(props: NodeItemProps) {
  return (
    <IconShell
      {...props}
      icon={<FacebookLogo size={36} />}
      label="Meta Ad"
      tint="#DBEAFE"
    />
  );
}
