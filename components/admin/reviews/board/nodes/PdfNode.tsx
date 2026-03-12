// components/admin/reviews/board/nodes/PdfNode.tsx
'use client';

import { FileText } from 'lucide-react';
import { type NodeItemProps, CardShell } from './nodeConfig';

function PdfThumbnail({ item }: { item: NodeItemProps['item'] }) {
  const src = item.image_url || item.screenshot_url;

  if (src) {
    return (
      <div className="w-full h-full relative">
        <img src={src} alt={item.title} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-red-50/50">
      <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-red-400">
        <FileText size={18} />
      </div>
    </div>
  );
}

export default function PdfNode(props: NodeItemProps) {
  return (
    <CardShell {...props} typeIcon={<FileText size={14} />} typeLabel="PDF">
      <PdfThumbnail item={props.item} />
    </CardShell>
  );
}
