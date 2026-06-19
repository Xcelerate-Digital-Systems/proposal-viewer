'use client';

import { type NodeItemProps, CardShell, FacebookLogo } from './nodeConfig';

function LeadFormThumbnail({ item }: { item: NodeItemProps['item'] }) {
  const data = item.meta_lead_form_data;
  const cover = data?.cover_url;

  if (cover) {
    return (
      <div className="w-full h-full relative">
        <img src={cover} alt={item.title} loading="lazy" className="w-full h-full object-cover" />
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
