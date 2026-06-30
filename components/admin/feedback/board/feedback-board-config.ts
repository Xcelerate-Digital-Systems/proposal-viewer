import { MarkerType } from '@xyflow/react';

export const defaultEdgeOptions = {
  type: 'labeled',
  animated: false,
  style: { stroke: '#2B2B2B', strokeWidth: 1.8 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#2B2B2B', width: 16, height: 16 },
};

export const DRAW_COLOR = '#2B2B2B';
export const DRAW_STROKE_WIDTH = 2;
export const MIN_SHAPE_SIZE = 10;
export const ARROW_HEAD = 14;
export const ARROW_ANGLE = Math.PI / 6;

export const SHORTCUTS = [
  ['V', 'Select'],
  ['R', 'Rectangle'],
  ['O', 'Ellipse'],
  ['A', 'Arrow'],
  ['L', 'Line'],
  ['T', 'Text'],
  ['N', 'Sticky note'],
  ['⌘C', 'Copy'],
  ['⌘V', 'Paste'],
  ['⌘D', 'Duplicate'],
  ['⌘Z', 'Undo'],
  ['⌘⇧Z', 'Redo'],
  ['⌫', 'Delete'],
] as const;
