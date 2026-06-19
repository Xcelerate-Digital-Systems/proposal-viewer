'use client';

import { Image as ImageIcon } from 'lucide-react';
import { type NodeItemProps, CardShell } from './nodeConfig';

function ImageThumbnail({ item }: { item: NodeItemProps['item'] }) {
  const src = item.image_url || item.ad_creative_url;

  if (src) {
    return <img src={src} alt={item.title} loading="lazy" className="w-full h-full object-cover" />;
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-surface">
      <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-faint">
        <ImageIcon size={14} />
      </div>
    </div>
  );
}

export default function ImageNode(props: NodeItemProps) {
  return (
    <CardShell {...props} typeIcon={<ImageIcon size={14} />} typeLabel="Image">
      <ImageThumbnail item={props.item} />
    </CardShell>
  );
}