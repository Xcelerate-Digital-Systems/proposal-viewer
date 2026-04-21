'use client';

import { MousePointer2, Square, Circle, MoveRight, Minus, Type, StickyNote, Diamond, Clock } from 'lucide-react';
import type { ReactNode } from 'react';

export type BoardTool = 'select' | 'sticky' | 'rectangle' | 'ellipse' | 'arrow' | 'line' | 'text' | 'decision' | 'wait';

interface ToolDef {
  id: BoardTool;
  icon: ReactNode;
  label: string;
  shortcut: string;
  comingSoon?: boolean;
}

const TOOLS: ToolDef[] = [
  { id: 'select', icon: <MousePointer2 size={22} strokeWidth={1.7} />, label: 'Select', shortcut: 'V' },
  { id: 'rectangle', icon: <Square size={22} strokeWidth={1.7} />, label: 'Rectangle', shortcut: 'R' },
  { id: 'ellipse', icon: <Circle size={22} strokeWidth={1.7} />, label: 'Ellipse', shortcut: 'O' },
  { id: 'arrow', icon: <MoveRight size={22} strokeWidth={1.7} />, label: 'Arrow', shortcut: 'A' },
  { id: 'line', icon: <Minus size={22} strokeWidth={2.2} />, label: 'Line', shortcut: 'L' },
  { id: 'text', icon: <Type size={22} strokeWidth={1.7} />, label: 'Text', shortcut: 'T' },
  { id: 'decision', icon: <Diamond size={22} strokeWidth={1.7} />, label: 'Decision', shortcut: 'D' },
  { id: 'wait', icon: <Clock size={22} strokeWidth={1.7} />, label: 'Wait Step', shortcut: 'W' },
  { id: 'sticky', icon: <StickyNote size={22} strokeWidth={1.7} />, label: 'Sticky Note', shortcut: 'N' },
];

interface Props {
  activeTool: BoardTool;
  onToolSelect: (tool: BoardTool) => void;
}

export default function BoardTopToolbar({ activeTool, onToolSelect }: Props) {
  return (
    <div className="flex items-center gap-1.5 bg-paper rounded-2xl border-2 border-sketch-ink/70 shadow-sketch-lg px-3 py-2 font-hand">
      {TOOLS.map((tool) => {
        const active = activeTool === tool.id;
        const soon = tool.comingSoon;
        return (
          <button
            key={tool.id}
            onClick={() => !soon && onToolSelect(tool.id)}
            disabled={soon}
            className={`group relative w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
              active
                ? 'bg-teal text-white shadow-sketch'
                : soon
                ? 'text-sketch-ink/30 cursor-not-allowed'
                : 'text-sketch-ink/80 hover:bg-paper-dark hover:text-sketch-ink'
            }`}
            title={`${tool.label}${soon ? ' — coming soon' : ` (${tool.shortcut})`}`}
          >
            {tool.icon}
            {!soon && (
              <span
                className={`absolute bottom-1 right-1.5 text-[11px] font-hand leading-none ${
                  active ? 'text-white/70' : 'text-sketch-ink/40'
                }`}
              >
                {tool.shortcut}
              </span>
            )}
            {soon && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none">
                soon
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
