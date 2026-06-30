'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useFunnelBoardContextOrThrow } from './FunnelBoardContext';
import type { FunnelStep, FunnelStepType } from '@/lib/supabase';
import type { NewShape } from './FunnelBoardContext';
import { alignNodesCentre, distributeNodes, autoLayout } from '@/components/admin/shared/board-utils';
import { visualCentre } from './funnel-board-config';

type ClipboardEntry =
  | { kind: 'step'; stepType: FunnelStepType; label: string; icon: string | null; url: string | null; color: string | null; metrics: unknown }
  | { kind: 'shape'; data: Omit<NewShape, never> }
  | { kind: 'note'; content: string; color: string; width: number; height: number; font_size: number | null };

/**
 * Encapsulates clipboard operations (copy/paste/duplicate/delete),
 * lock/unlock state, and keyboard shortcuts for the funnel board.
 */
export function useFunnelBoardClipboard(
  viewportCentre: () => { x: number; y: number },
) {
  const ctx = useFunnelBoardContextOrThrow();
  const rf = useReactFlow();

  const clipboardRef = useRef<ClipboardEntry[]>([]);
  const [lockedNodes, setLockedNodes] = useState<Set<string>>(new Set());

  /* ─── Duplicate selected nodes (Cmd+D + context-menu action) ─── */

  const duplicateSelected = useCallback(async () => {
    let selected = rf.getNodes().filter((n) => n.selected);
    if (selected.length === 0) {
      const fallbackId = ctx.selectedStepId
        ? `step-${ctx.selectedStepId}`
        : ctx.selectedShapeId
        ? `shape-${ctx.selectedShapeId}`
        : ctx.selectedNoteId
        ? `note-${ctx.selectedNoteId}`
        : null;
      if (!fallbackId) return;
      const node = rf.getNodes().find((n) => n.id === fallbackId);
      if (!node) return;
      selected = [node];
    }
    for (const node of selected) {
      if (node.id.startsWith('step-')) {
        const origId = node.id.slice(5);
        const orig = ctx.steps.find((s) => s.id === origId);
        if (!orig) continue;
        const next = await ctx.createStep(orig.step_type, { x: orig.board_x + 40, y: orig.board_y + 40 });
        if (next) {
          await ctx.updateStep(next.id, {
            label: orig.label, icon: orig.icon, url: orig.url,
            color: orig.color, metrics: orig.metrics,
          });
        }
      } else if (node.id.startsWith('shape-')) {
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
        const next = await ctx.addNote({ x: orig.board_x + 40, y: orig.board_y + 40 });
        if (next) {
          await ctx.updateNote(next.id, {
            content: orig.content, color: orig.color,
            width: orig.width, height: orig.height, font_size: orig.font_size,
          });
        }
      }
    }
  }, [rf, ctx]);

  const deleteSelected = useCallback(async () => {
    const selected = rf.getNodes().filter((n) => n.selected);
    for (const node of selected) {
      if (node.id.startsWith('note-'))       await ctx.deleteNote(node.id.slice(5));
      else if (node.id.startsWith('shape-')) await ctx.deleteShape(node.id.slice(6));
      else if (node.id.startsWith('step-'))  await ctx.deleteStep(node.id.slice(5));
    }
  }, [rf, ctx]);

  /* ─── Lock / unlock ─── */

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

  useEffect(() => {
    rf.setNodes((nds) => nds.map((n) => ({
      ...n,
      draggable: !lockedNodes.has(n.id),
      className: lockedNodes.has(n.id) ? 'opacity-80' : undefined,
    })));
  }, [lockedNodes, rf]);

  /* ─── Copy / paste ─── */

  const copySelected = useCallback(() => {
    const selected = rf.getNodes().filter((n) => n.selected);
    if (selected.length === 0) return;
    const entries: ClipboardEntry[] = [];
    for (const node of selected) {
      if (node.id.startsWith('step-')) {
        const orig = ctx.steps.find((s) => s.id === node.id.slice(5));
        if (!orig) continue;
        entries.push({
          kind: 'step', stepType: orig.step_type,
          label: orig.label, icon: orig.icon, url: orig.url,
          color: orig.color, metrics: orig.metrics,
        });
      } else if (node.id.startsWith('shape-')) {
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
      if (entry.kind === 'step') {
        const next = await ctx.createStep(entry.stepType, { x: c.x + ox - 100, y: c.y + oy - 100 });
        if (next) await ctx.updateStep(next.id, { label: entry.label, icon: entry.icon, url: entry.url, color: entry.color, metrics: entry.metrics as FunnelStep['metrics'] });
      } else if (entry.kind === 'shape') {
        await ctx.createShape({ ...entry.data, x: c.x + ox - 100, y: c.y + oy - 100 });
      } else {
        const note = await ctx.addNote({ x: c.x + ox - 100, y: c.y + oy - 75 });
        if (note) await ctx.updateNote(note.id, { content: entry.content, color: entry.color, width: entry.width, height: entry.height, font_size: entry.font_size });
      }
      offsetIdx++;
    }
  }, [ctx, viewportCentre]);

  /* ─── Keyboard: pan, Cmd-Z/Y undo+redo, Cmd-C/V copy+paste, Cmd-D duplicate ─── */

  useEffect(() => {
    const PAN_STEP = 50;
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (tgt?.closest('[data-side-drawer]') || tgt?.closest('[role="dialog"]') || tgt?.closest('[role="listbox"]')) return;

      // Shift+Arrow: pan the canvas without a mouse
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const vp = rf.getViewport();
        const dx = e.key === 'ArrowLeft' ? PAN_STEP : e.key === 'ArrowRight' ? -PAN_STEP : 0;
        const dy = e.key === 'ArrowUp' ? PAN_STEP : e.key === 'ArrowDown' ? -PAN_STEP : 0;
        rf.setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom }, { duration: 120 });
        return;
      }

      // Arrow keys (no modifier): nudge selected nodes
      const mod = e.metaKey || e.ctrlKey;
      if (!mod && !e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const selected = rf.getNodes().filter((n) => n.selected);
        if (selected.length > 0) {
          e.preventDefault();
          const step = e.altKey ? 1 : 10;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          rf.setNodes((nds) => nds.map((n) => {
            if (!n.selected) return n;
            return { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } };
          }));
          for (const n of selected) {
            const nx = n.position.x + dx;
            const ny = n.position.y + dy;
            if (n.id.startsWith('note-')) void ctx.updateNote(n.id.slice(5), { board_x: nx, board_y: ny });
            else if (n.id.startsWith('shape-')) void ctx.updateShape(n.id.slice(6), { x: nx, y: ny });
            else if (n.id.startsWith('step-')) void ctx.updateStep(n.id.slice(5), { board_x: nx, board_y: ny });
          }
          return;
        }
      }

      if (!mod) return;
      if (e.key === '1') {
        e.preventDefault();
        rf.fitView({ duration: 300, padding: 0.2 });
      } else if (e.key === '0') {
        e.preventDefault();
        const selected = rf.getNodes().filter((n) => n.selected);
        if (selected.length > 0) rf.fitView({ duration: 300, padding: 0.3, nodes: selected });
        else rf.fitView({ duration: 300, padding: 0.2 });
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        copySelected();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        void pasteAtViewport();
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) void ctx.redo(); else void ctx.undo();
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        void ctx.redo();
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        void duplicateSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ctx, rf, duplicateSelected, copySelected, pasteAtViewport]);

  const savePosition = useCallback((nodeId: string, x: number, y: number) => {
    if (nodeId.startsWith('note-')) void ctx.updateNote(nodeId.slice(5), { board_x: x, board_y: y });
    else if (nodeId.startsWith('shape-')) void ctx.updateShape(nodeId.slice(6), { x, y });
    else if (nodeId.startsWith('step-')) void ctx.updateStep(nodeId.slice(5), { board_x: x, board_y: y });
  }, [ctx]);

  const applyMoves = useCallback((moves: Map<string, { x: number; y: number }>) => {
    if (moves.size === 0) return;
    rf.setNodes((nds) => nds.map((n) => {
      const m = moves.get(n.id);
      return m ? { ...n, position: m } : n;
    }));
    moves.forEach((pos, id) => savePosition(id, pos.x, pos.y));
  }, [rf, savePosition]);

  const alignH = useCallback(() => {
    applyMoves(alignNodesCentre(rf.getNodes().filter((n) => n.selected), 'horizontal', visualCentre));
  }, [rf, applyMoves]);

  const alignV = useCallback(() => {
    applyMoves(alignNodesCentre(rf.getNodes().filter((n) => n.selected), 'vertical', visualCentre));
  }, [rf, applyMoves]);

  const distributeH = useCallback(() => {
    applyMoves(distributeNodes(rf.getNodes().filter((n) => n.selected), 'horizontal', visualCentre));
  }, [rf, applyMoves]);

  const distributeV = useCallback(() => {
    applyMoves(distributeNodes(rf.getNodes().filter((n) => n.selected), 'vertical', visualCentre));
  }, [rf, applyMoves]);

  const tidyLayout = useCallback((direction: 'TB' | 'LR' = 'LR') => {
    const nodes = rf.getNodes();
    const edges = rf.getEdges();
    if (nodes.length < 2) return;
    applyMoves(autoLayout(nodes, edges, direction));
    setTimeout(() => rf.fitView({ duration: 300, padding: 0.2 }), 50);
  }, [rf, applyMoves]);

  return {
    clipboardRef,
    lockedNodes,
    duplicateSelected,
    deleteSelected,
    toggleLockSelected,
    copySelected,
    pasteAtViewport,
    alignH,
    alignV,
    distributeH,
    distributeV,
    tidyLayout,
  };
}
