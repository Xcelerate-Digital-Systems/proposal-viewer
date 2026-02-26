// components/admin/reviews/board/nodes/ImageNode.tsx
'use client';

import { Image as ImageIcon } from 'lucide-react';
import { type NodeItemProps, CardShell } from './nodeConfig';

function ImageThumbnail({ item }: { item: NodeItemProps['item'] }) {
  const src = item.image_url || item.screenshot_url || item.ad_creative_url;

  if (src) {
    return <img src={src} alt={item.title} className="w-full h-full object-cover" />;
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
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