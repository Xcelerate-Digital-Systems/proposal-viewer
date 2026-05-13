'use client';

import { Globe } from 'lucide-react';
import { type NodeItemProps, CardShell } from './nodeConfig';

function WebsiteThumbnail({ item }: { item: NodeItemProps['item'] }) {
  if (item.url) {
    return (
      <div className="w-full h-full relative overflow-hidden">
        <iframe
          src={item.url}
          title={item.title}
          className="absolute top-0 left-0 border-0 pointer-events-none"
          style={{ width: '500%', height: '500%', transform: 'scale(0.2)', transformOrigin: 'top left' }}
          sandbox="allow-same-origin"
          loading="lazy"
          tabIndex={-1}
        />
        <div className="absolute inset-0 z-10" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
        <Globe size={14} />
      </div>
    </div>
  );
}

export default function WebsiteNode(props: NodeItemProps) {
  return (
    <CardShell {...props} typeIcon={<Globe size={14} />} typeLabel="Web Page">
      <WebsiteThumbnail item={props.item} />
    </CardShell>
  );
}
