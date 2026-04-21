'use client';

import { type NodeItemProps, IconShell } from './nodeConfig';

function FacebookLogo({ size = 30 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 36 36"
      width={size}
      height={size}
      fill="#1877F2"
      aria-label="Facebook"
    >
      <path d="M20.181 35.87C29.094 34.791 36 27.202 36 18c0-9.941-8.059-18-18-18S0 8.059 0 18c0 8.442 5.811 15.526 13.652 17.471L13.652 23.2H9.486V18h4.166v-3.51c0-5.269 3.233-7.944 7.71-7.944 2.106 0 3.88.158 4.397.228v5.26H23.11c-2.37 0-2.929 1.453-2.929 3.09V18h5.6l-.727 5.2h-4.873L20.181 35.87z" />
    </svg>
  );
}

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
