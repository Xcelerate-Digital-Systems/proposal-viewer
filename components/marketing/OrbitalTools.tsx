'use client';

import { useReducedMotion } from 'framer-motion';
import {
  FileText, Receipt, MonitorPlay,
  FlowArrow, BookmarkSimple, ChatDots,
} from '@phosphor-icons/react';

const TOOLS = [
  { icon: FileText, label: 'Proposals' },
  { icon: Receipt, label: 'Quotes' },
  { icon: MonitorPlay, label: 'Docs' },
  { icon: ChatDots, label: 'Markup' },
  { icon: FlowArrow, label: 'Funnels' },
  { icon: BookmarkSimple, label: 'Swipe Vault' },
];

const DURATION = 24;
const RADIUS = 84;

export function OrbitalTools() {
  const reduce = useReducedMotion();

  return (
    <div className="relative w-[200px] h-[200px] mx-auto flex items-center justify-center">
      {/* Center hub */}
      <div className="absolute z-10 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal to-teal-hover flex items-center justify-center shadow-[0_0_20px_rgba(1,124,135,0.35)]">
          <div className="w-5 h-5 rounded-full bg-white/90" />
        </div>
      </div>

      {/* Orbit ring */}
      <div className="absolute w-[168px] h-[168px] rounded-full border border-white/[0.08]" />

      {/* Tools — pure CSS orbit, zero React re-renders */}
      {TOOLS.map((tool, i) => {
        const offset = -(i / TOOLS.length) * DURATION;
        const staticAngle = (360 / TOOLS.length) * i;
        const Icon = tool.icon;

        return (
          <div
            key={tool.label}
            className="absolute left-1/2 top-1/2 -ml-4 -mt-4"
            style={
              reduce
                ? { transform: `rotate(${staticAngle}deg) translateX(${RADIUS}px) rotate(-${staticAngle}deg)` }
                : { animation: `orbit-tool ${DURATION}s linear infinite`, animationDelay: `${offset}s` }
            }
          >
            <div className="w-8 h-8 rounded-full bg-surface-dark-deep border-2 border-surface-dark-accent/30 flex items-center justify-center shadow-[0_0_10px_rgba(138,217,209,0.1)]">
              <Icon size={13} weight="duotone" className="text-surface-dark-accent" />
            </div>
            <span className="absolute top-9 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-medium text-white/50 tracking-wide">
              {tool.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
