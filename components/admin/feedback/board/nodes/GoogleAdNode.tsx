'use client';

import { type NodeItemProps, IconShell } from './nodeConfig';

function GoogleLogo({ size = 34 }: { size?: number }) {
  return (
    <img
      src="/icons/brands/google.svg"
      alt="Google"
      width={size}
      height={size}
      style={{ filter: 'brightness(0) invert(1)' }}
    />
  );
}

export default function GoogleAdNode(props: NodeItemProps) {
  const label = props.item.type === 'google_banner_ad' ? 'Google Banner Ad' : 'Google Search Ad';
  return (
    <IconShell
      {...props}
      icon={<GoogleLogo size={34} />}
      label={label}
      tint="#4285F4"
      solid
    />
  );
}
