'use client';

import { type NodeItemProps, CardShell } from './nodeConfig';

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

function LeadFormThumbnail({ item }: { item: NodeItemProps['item'] }) {
  const data = item.meta_lead_form_data;
  const cover = data?.cover_url;

  if (cover) {
    return (
      <div className="w-full h-full relative">
        <img src={cover} alt={item.title} className="w-full h-full object-cover" />
        <div className="absolute bottom-1.5 left-1.5 w-6 h-6 rounded-full bg-white/95 flex items-center justify-center shadow-sm">
          <FacebookLogo size={16} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #DBEAFE 0%, #EFF6FF 100%)' }}
    >
      <FacebookLogo size={44} />
    </div>
  );
}

export default function MetaLeadFormNode(props: NodeItemProps) {
  return (
    <CardShell {...props} typeIcon={<FacebookLogo size={11} />} typeLabel="Lead Form">
      <LeadFormThumbnail item={props.item} />
    </CardShell>
  );
}
