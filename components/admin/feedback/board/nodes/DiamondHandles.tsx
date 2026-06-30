'use client';

import { Handle, Position } from '@xyflow/react';
import {
  HANDLE_CLASS,
  DIAMOND_TOP_Y,
  DIAMOND_MID_Y,
  DIAMOND_SIDE_OUTSET,
  DIAMOND_NODE_H,
  HANDLE_OUTSET,
} from './diamond-config';

export function DiamondHandles({ readOnly }: { readOnly?: boolean }) {
  // Each handle sits a few px outward from its diamond corner so the dot is
  // visibly off the shape rather than overlapping it.
  const topStyle    = { top: DIAMOND_TOP_Y - DIAMOND_SIDE_OUTSET };
  const leftStyle   = { top: DIAMOND_MID_Y, left: -DIAMOND_SIDE_OUTSET };
  const rightStyle  = { top: DIAMOND_MID_Y, right: -DIAMOND_SIDE_OUTSET };
  // Bottom handle sits just past the label — no extra gap below the label so
  // the next node's connection sits close to this one.
  const bottomStyle = { top: DIAMOND_NODE_H + HANDLE_OUTSET, bottom: 'auto' as const };
  return (
    <>
      <Handle id="top"           type="source" position={Position.Top}    className={HANDLE_CLASS} style={topStyle}    isConnectable={!readOnly} />
      <Handle id="top-source"    type="source" position={Position.Top}    className={HANDLE_CLASS} style={topStyle}    isConnectable={!readOnly} />
      <Handle id="left"          type="source" position={Position.Left}   className={HANDLE_CLASS} style={leftStyle}   isConnectable={!readOnly} />
      <Handle id="left-source"   type="source" position={Position.Left}   className={HANDLE_CLASS} style={leftStyle}   isConnectable={!readOnly} />
      <Handle id="right"         type="source" position={Position.Right}  className={HANDLE_CLASS} style={rightStyle}  isConnectable={!readOnly} />
      <Handle id="right-target"  type="source" position={Position.Right}  className={HANDLE_CLASS} style={rightStyle}  isConnectable={!readOnly} />
      <Handle id="bottom"        type="source" position={Position.Bottom} className={HANDLE_CLASS} style={bottomStyle} isConnectable={!readOnly} />
      <Handle id="bottom-target" type="source" position={Position.Bottom} className={HANDLE_CLASS} style={bottomStyle} isConnectable={!readOnly} />
    </>
  );
}
