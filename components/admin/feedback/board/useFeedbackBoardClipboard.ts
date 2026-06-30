'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useFeedbackBoardContextOrThrow, type NewShape } from './FeedbackBoardContext';
import { alignNodesCentre, distributeNodes, autoLayout } from '@/components/admin/shared/board-utils';
import { genericVisualCentre as visualCentre } from '@/components/admin/shared/board-utils';
import { nextGroupColor, type GroupNodeData } from '@/components/admin/shared/GroupNode';

type ClipboardEntry =
  | { kind: 'shape'; data: Omit<NewShape, never> }
  | { kind: 'note'; content: string; color: string; width: number; height: number; font_size: number | null };

/**
 * Encapsulates clipboard operations (copy/paste/duplicate/delete),
 * lock/unlock state, and layout helpers for the feedback board.
 */
export function useFeedbackBoardClipboard(
  viewportCentre: () => { x: number; y: number },
) {
  const ctx = useFeedbackBoardContextOrThrow();
  const rf = useReactFlow();
  const confirm = useConfirm();

  const clipboardRef = useRef<ClipboardEntry[]>([]);
  const [lockedNodes, setLockedNodes] = useState<Set<string>>(new Set());

  /* ── Duplicate selected (notes + shapes only) ────────────── */

  const duplicateSelected = useCallback(async () => {
    const selected = rf.getNodes().filter((n) => n.selected);
    if (selected.length === 0) return;
    for (const node of selected) {
      if (node.id.startsWith('shape-')) {
        const origId = node.id.slice(6);
        const orig = ctx.shapes.find((s) => s.id === origId);
        if (!orig) continue;
        await ctx.createShape({
          shape_type: orig.shape_type,
          x: orig.x + 40, y: orig.y + 40,
          width: orig.width, height: orig.height,
          end_x: orig.end_x, end_y: orig.end_y,
          content: orig.content,
          color: orig.color, stroke_width: orig.stroke_width,
          dashed: orig.dashed, font_size: orig.font_size,
        });
      } else if (node.id.startsWith('note-')) {
        const origId = node.id.slice(5);
        const orig = ctx.boardNotes.find((n) => n.id === origId);
        if (!orig) continue;
        const next = await ctx.addNote();
        if (next) {
          await ctx.updateNote(next.id, {
            content: orig.content, color: orig.color,
            width: orig.width, height: orig.height, font_size: orig.font_size,
            board_x: orig.board_x + 40, board_y: orig.board_y + 40,
          });
        }
      }
      // Review-item nodes intentionally skipped
    }
  }, [rf, ctx]);

  const deleteSelected = useCallback(async () => {
    const selected = rf.getNodes().filter((n) => n.selected);
    if (selected.length === 0) return;
    const nonGroupCount = selected.filter((n) => n.type !== 'group').length;
    if (nonGroupCount > 1) {
      const ok = await confirm({
        message: `Delete ${nonGroupCount} selected items? Connected edges will also be removed.`,
        destructive: true,
        confirmLabel: `Delete ${nonGroupCount} items`,
      });
      if (!ok) return;
    }
    const groupIds = new Set(selected.filter((n) => n.type === 'group').map((n) => n.id));
    if (groupIds.size > 0) {
      rf.setNodes((nds) => {
        const groups = new Map<string, Node>();
        for (const n of nds) {
          if (groupIds.has(n.id)) groups.set(n.id, n);
        }
        return nds
          .filter((n) => !groupIds.has(n.id))
          .map((n) => {
            if (n.parentId && groupIds.has(n.parentId)) {
              const parent = groups.get(n.parentId);
              return {
                ...n,
                parentId: undefined,
                extent: undefined,
                position: { x: n.position.x + (parent?.position.x ?? 0), y: n.position.y + (parent?.position.y ?? 0) },
              };
            }
            return n;
          });
      });
    }
    for (const node of selected) {
      if (node.type === 'group') continue;
      if (node.id.startsWith('note-'))       await ctx.deleteNote(node.id.slice(5));
      else if (node.id.startsWith('shape-')) await ctx.deleteShape(node.id.slice(6));
      else                                    await ctx.removeItemFromBoard(node.id);
    }
  }, [rf, ctx, confirm]);

  /* ── Lock / unlock ────────────────────────────────────── */

  const toggleLockSelected = useCallback(() => {
    const selected = rf.getNodes().filter((n) => n.selected);
    if (selected.length === 0) return;
    const allLocked = selected.every((n) => lockedNodes.has(n.id));
    setLockedNodes((prev) => {
      const next = new Set(prev);
      for (const n of selected) {
        if (allLocked) next.delete(n.id); else next.add(n.id);
      }
      return next;
    });
  }, [rf, lockedNodes]);

  // Apply lock state to nodes
  useEffect(() => {
    rf.setNodes((nds) => nds.map((n) => ({
      ...n,
      draggable: !lockedNodes.has(n.id),
      className: lockedNodes.has(n.id) ? 'opacity-80' : undefined,
    })));
  }, [lockedNodes, rf]);

  /* ── Copy / paste ─────────────────────────────────────── */

  const copySelected = useCallback(() => {
    const selected = rf.getNodes().filter((n) => n.selected);
    if (selected.length === 0) return;
    const entries: ClipboardEntry[] = [];
    for (const node of selected) {
      if (node.id.startsWith('shape-')) {
        const orig = ctx.shapes.find((s) => s.id === node.id.slice(6));
        if (!orig) continue;
        entries.push({
          kind: 'shape',
          data: {
            shape_type: orig.shape_type, x: orig.x, y: orig.y,
            width: orig.width, height: orig.height,
            end_x: orig.end_x, end_y: orig.end_y,
            content: orig.content, color: orig.color,
            stroke_width: orig.stroke_width, dashed: orig.dashed, font_size: orig.font_size,
          },
        });
      } else if (node.id.startsWith('note-')) {
        const orig = ctx.boardNotes.find((n) => n.id === node.id.slice(5));
        if (!orig) continue;
        entries.push({
          kind: 'note',
          content: orig.content || '', color: orig.color || '#FFF4B8',
          width: orig.width || 200, height: orig.height || 150,
          font_size: orig.font_size,
        });
      }
    }
    clipboardRef.current = entries;
  }, [rf, ctx]);

  const pasteAtViewport = useCallback(async () => {
    if (clipboardRef.current.length === 0) return;
    const c = viewportCentre();
    let offsetIdx = 0;
    for (const entry of clipboardRef.current) {
      const ox = 40 * offsetIdx;
      const oy = 40 * offsetIdx;
      if (entry.kind === 'shape') {
        await ctx.createShape({ ...entry.data, x: c.x + ox - 120, y: c.y + oy - 120 });
      } else {
        const note = await ctx.addNote();
        if (note) {
          await ctx.updateNote(note.id, {
            content: entry.content, color: entry.color,
            width: entry.width, height: entry.height, font_size: entry.font_size,
            board_x: Math.round(c.x + ox - 100), board_y: Math.round(c.y + oy - 75),
          });
        }
      }
      offsetIdx++;
    }
  }, [ctx, viewportCentre]);

  /* ── Alignment & layout helpers ──────────────────────── */

  const savePosition = useCallback((nodeId: string, x: number, y: number) => {
    if (nodeId.startsWith('note-')) void ctx.updateNote(nodeId.slice(5), { board_x: x, board_y: y });
    else if (nodeId.startsWith('shape-')) void ctx.updateShape(nodeId.slice(6), { x, y });
    else void ctx.updateItemBoardPosition(nodeId, x, y);
  }, [ctx]);

  const applyMoves = useCallback((moves: Map<string, { x: number; y: number }>) => {
    if (moves.size === 0) return;
    rf.setNodes((nds) => nds.map((n) => {
      const m = moves.get(n.id);
      return m ? { ...n, position: m } : n;
    }));
    moves.forEach((pos, id) => savePosition(id, pos.x, pos.y));
  }, [rf, savePosition]);

  const handleAlignH = useCallback(() => {
    applyMoves(alignNodesCentre(rf.getNodes().filter((n) => n.selected), 'horizontal', visualCentre));
  }, [rf, applyMoves]);

  const handleAlignV = useCallback(() => {
    applyMoves(alignNodesCentre(rf.getNodes().filter((n) => n.selected), 'vertical', visualCentre));
  }, [rf, applyMoves]);

  const handleDistributeH = useCallback(() => {
    applyMoves(distributeNodes(rf.getNodes().filter((n) => n.selected), 'horizontal', visualCentre));
  }, [rf, applyMoves]);

  const handleDistributeV = useCallback(() => {
    applyMoves(distributeNodes(rf.getNodes().filter((n) => n.selected), 'vertical', visualCentre));
  }, [rf, applyMoves]);

  const tidyLayout = useCallback((direction: 'TB' | 'LR' = 'LR') => {
    const nodes = rf.getNodes();
    const edges = rf.getEdges();
    if (nodes.length < 2) return;
    applyMoves(autoLayout(nodes, edges, direction));
    setTimeout(() => rf.fitView({ duration: 300, padding: 0.2 }), 50);
  }, [rf, applyMoves]);

  /* ─── Group / ungroup ─── */

  const GROUP_PAD = 30;

  const groupSelected = useCallback(() => {
    const selected = rf.getNodes().filter((n) => n.selected && n.type !== 'group');
    if (selected.length < 2) return;

    const xs = selected.map((n) => n.position.x);
    const ys = selected.map((n) => n.position.y);
    const ws = selected.map((n) => (n as Node & { measured?: { width?: number } }).measured?.width ?? 200);
    const hs = selected.map((n) => (n as Node & { measured?: { height?: number } }).measured?.height ?? 120);

    const minX = Math.min(...xs) - GROUP_PAD;
    const minY = Math.min(...ys) - GROUP_PAD;
    const maxX = Math.max(...xs.map((x, i) => x + ws[i])) + GROUP_PAD;
    const maxY = Math.max(...ys.map((y, i) => y + hs[i])) + GROUP_PAD;

    const groupId = `group-${Date.now()}`;
    const color = nextGroupColor();

    const groupNode: Node = {
      id: groupId,
      type: 'group',
      position: { x: minX, y: minY },
      style: { width: maxX - minX, height: maxY - minY },
      data: { label: 'Group', color } satisfies GroupNodeData,
    };

    rf.setNodes((nds) => {
      const reparented = nds.map((n) => {
        if (!n.selected || n.type === 'group') return n;
        return {
          ...n,
          parentId: groupId,
          extent: 'parent' as const,
          position: { x: n.position.x - minX, y: n.position.y - minY },
          selected: false,
        };
      });
      return [groupNode, ...reparented];
    });
  }, [rf]);

  const ungroupSelected = useCallback(() => {
    const selected = rf.getNodes().filter((n) => n.selected);
    const groupIds = new Set(selected.filter((n) => n.type === 'group').map((n) => n.id));
    if (groupIds.size === 0) {
      const parentIds = new Set(selected.map((n) => n.parentId).filter(Boolean) as string[]);
      parentIds.forEach((id) => groupIds.add(id));
    }
    if (groupIds.size === 0) return;

    rf.setNodes((nds) => {
      const groups = new Map<string, Node>();
      for (const n of nds) {
        if (groupIds.has(n.id) && n.type === 'group') groups.set(n.id, n);
      }
      return nds
        .filter((n) => !groupIds.has(n.id))
        .map((n) => {
          if (n.parentId && groupIds.has(n.parentId)) {
            const parent = groups.get(n.parentId);
            const px = parent?.position.x ?? 0;
            const py = parent?.position.y ?? 0;
            return {
              ...n,
              parentId: undefined,
              extent: undefined,
              position: { x: n.position.x + px, y: n.position.y + py },
            };
          }
          return n;
        });
    });
  }, [rf]);

  const hasGroupInSelection = useCallback(() => {
    const selected = rf.getNodes().filter((n) => n.selected);
    return selected.some((n) => n.type === 'group' || n.parentId);
  }, [rf]);

  return {
    clipboardRef,
    lockedNodes,
    duplicateSelected,
    deleteSelected,
    toggleLockSelected,
    copySelected,
    pasteAtViewport,
    savePosition,
    handleAlignH,
    handleAlignV,
    handleDistributeH,
    handleDistributeV,
    tidyLayout,
    groupSelected,
    ungroupSelected,
    hasGroupInSelection,
  };
}
