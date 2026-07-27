'use client';

import { type NodeItemProps, IconShell } from './nodeConfig';

function MetaLogo({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/icons/brands/facebook.svg"
      alt="Meta"
      width={size}
      height={size}
      style={{ filter: 'brightness(0) invert(1)' }}
    />
  );
}

export default function FacebookNode(props: NodeItemProps) {
  return (
    <IconShell
      {...props}
      icon={<MetaLogo size={36} />}
      label="Meta Ad"
      tint="#1877F2"
      solid
    />
  );
}
