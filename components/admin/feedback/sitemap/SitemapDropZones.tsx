'use client';

import { useStore } from '@xyflow/react';

export interface DropZone {
  id: string;
  parentId: string;
  x: number;
  y: number;
  height: number;
  sortOrder: number;
}

export interface SectionTarget {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  zones: DropZone[];
  activeZoneId: string | null;
  sectionTargets: SectionTarget[];
  activeSectionId: string | null;
}

export default function SitemapDropZones({ zones, activeZoneId, sectionTargets, activeSectionId }: Props) {
  const transform = useStore((s) => (s as Record<string, unknown>).transform as [number, number, number]);
  if (!transform) return null;
  const [tx, ty, scale] = transform;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
        transformOrigin: '0 0',
        zIndex: 5,
      }}
    >
      {zones.map((zone) => {
        const isActive = zone.id === activeZoneId;
        return (
          <div
            key={zone.id}
            className="absolute"
            style={{
              left: zone.x - (isActive ? 2 : 1),
              top: zone.y,
              width: isActive ? 4 : 2,
              height: zone.height,
              borderRadius: 2,
              background: isActive ? '#017C87' : '#cbd5e1',
              opacity: isActive ? 1 : 0.4,
              boxShadow: isActive ? '0 0 10px rgba(1,124,135,0.5), 0 0 20px rgba(1,124,135,0.2)' : 'none',
              transition: 'opacity 0.12s, box-shadow 0.12s, width 0.12s, background 0.12s',
            }}
          />
        );
      })}

      {sectionTargets.map((sec) => {
        const isActive = sec.id === activeSectionId;
        if (!isActive) return null;
        return (
          <div
            key={`sec-hl-${sec.id}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: sec.x - 4,
              top: sec.y - 4,
              width: sec.w + 8,
              height: sec.h + 8,
              border: '2px solid #017C87',
              background: 'rgba(1,124,135,0.08)',
              boxShadow: '0 0 12px rgba(1,124,135,0.3)',
              transition: 'all 0.12s',
            }}
          />
        );
      })}
    </div>
  );
}
