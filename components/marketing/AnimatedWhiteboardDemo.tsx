'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, Plus, Columns, GitBranch, GridFour, ChatCircle, Gear, Bell,
  Cursor, Square, Circle, ArrowLineRight, Minus, TextT, Note, FlowArrow,
  Image as ImageIcon, Envelope, Globe, DeviceMobile, Eye, CaretDown,
  ChatText, Megaphone, FileText,
} from '@phosphor-icons/react';

/* ── Animation config ────────────────────────────────────────────── */

const TOTAL_DURATION = 16;
const SCENE_COUNT = 8;
const SCENE_MS = (TOTAL_DURATION / SCENE_COUNT) * 1000;

/* ── Tab bar (matches real ProjectTabs) ──────────────────────────── */

const TABS = [
  { icon: Columns, label: 'Kanban' },
  { icon: GitBranch, label: 'Board', active: true },
  { icon: GridFour, label: 'Assets' },
  { icon: ChatCircle, label: 'Comments' },
  { icon: Gear, label: 'Setup' },
  { icon: Bell, label: 'Members' },
];

/* ── Drawing toolbar (matches real BoardTopToolbar) ──────────────── */

const DRAW_TOOLS = [
  { icon: Cursor, active: true },
  { icon: Square },
  { icon: Circle },
  { icon: ArrowLineRight },
  { icon: Minus },
  { icon: TextT },
  { icon: Note },
  { icon: null },
  { icon: FlowArrow },
];

/* ── Palette sidebar items ───────────────────────────────────────── */

const PALETTE_ITEMS = [
  { dot: 'bg-emerald-400', label: 'FACEBOOK AD' },
  { dot: 'bg-emerald-400', label: 'LANDING PAGE' },
  { dot: 'bg-amber-400', label: 'FORM PAGE' },
  { dot: 'bg-amber-400', label: 'THANK YOU PAGE' },
  { dot: 'bg-blue-400', label: 'SMS 01' },
  { dot: 'bg-blue-400', label: 'EMAIL 01' },
];

/* ── Board nodes — horizontal flow ───────────────────────────────── */

const FLOW_NODES = [
  { id: 'fb-ad', icon: Megaphone, label: 'Facebook Ad', status: 'Approved', dot: 'bg-emerald-400', thumb: 'from-teal-200 to-cyan-100', type: 'card' as const, typeLabel: 'Ad' },
  { id: 'landing', icon: Globe, label: 'Landing Page', status: 'Approved', dot: 'bg-emerald-400', thumb: 'from-sky-200 to-cyan-100', type: 'card' as const, typeLabel: 'Web' },
  { id: 'form', icon: FileText, label: 'Form Page', status: 'Internal Review', dot: 'bg-amber-400', thumb: 'from-amber-100 to-yellow-50', type: 'card' as const, typeLabel: 'Web' },
  { id: 'thankyou', icon: Globe, label: 'Thank You Page', status: 'Internal Review', dot: 'bg-amber-400', thumb: 'from-emerald-100 to-teal-50', type: 'card' as const, typeLabel: 'Web' },
  { id: 'sms', icon: DeviceMobile, label: 'SMS 01', status: 'Client Review', dot: 'bg-blue-400', thumb: '', type: 'icon' as const, typeLabel: 'SMS' },
  { id: 'email', icon: Envelope, label: 'EMAIL 01', status: 'Client Review', dot: 'bg-blue-400', thumb: '', type: 'icon' as const, typeLabel: 'Email' },
];

const STICKIES = [
  { x: 3, y: 72, color: 'bg-sticky-yellow', text: 'Update copy\nfor Q4 push' },
  { x: 22, y: 75, color: 'bg-sticky-pink', text: 'Need client\nsign-off by Fri' },
];

/* ── Cursor path — follows the horizontal flow ───────────────────── */

const CURSOR_PATH = {
  left: ['45%', '8%',  '8%',  '28%', '47%', '64%', '82%', '45%'],
  top:  ['60%', '30%', '30%', '30%', '30%', '30%', '30%', '60%'],
};
const CURSOR_TIMES = [0, 0.1, 0.22, 0.35, 0.48, 0.6, 0.75, 1];

/* ── Main component ──────────────────────────────────────────────── */

export function AnimatedWhiteboardDemo() {
  const reduce = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [showAssetView, setShowAssetView] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => {
      setScene(p => {
        const next = (p + 1) % SCENE_COUNT;
        if (next === 5) setShowAssetView(true);
        if (next === 7) setShowAssetView(false);
        return next;
      });
    }, SCENE_MS);
    return () => clearInterval(t);
  }, [reduce]);

  const activeNode =
    scene === 1 || scene === 2 ? 'fb-ad' :
    scene === 3 ? 'landing' :
    scene === 4 ? 'form' : null;

  const showComment = scene === 2;

  return (
    <div className="flex flex-col h-full bg-white text-ink overflow-hidden select-none">
      <AnimatePresence mode="wait">
        {showAssetView ? (
          <motion.div
            key="asset"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col h-full"
          >
            <AssetDetailView />
          </motion.div>
        ) : (
          <motion.div
            key="board"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col h-full"
          >
            <BoardView
              activeNode={activeNode}
              showComment={showComment}
              scene={scene}
              reduce={!!reduce}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Board view (main whiteboard) ────────────────────────────────── */

function BoardView({
  activeNode, showComment, scene, reduce,
}: {
  activeNode: string | null;
  showComment: boolean;
  scene: number;
  reduce: boolean;
}) {
  return (
    <>
      {/* Header row */}
      <div className="flex items-center justify-between px-3 md:px-5 py-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <ArrowLeft size={13} className="text-faint shrink-0" />
          <h1 className="text-[11px] md:text-sm font-semibold text-ink truncate">
            Coastal Realty – Spring Campaign
          </h1>
          <div className="hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface text-[8px] font-medium text-muted">
            <CaretDown size={8} />
            Active
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md border border-edge text-[9px] text-muted">
            <ChatText size={10} /> Note
          </div>
          <div className="px-2 py-1 rounded-md border border-edge text-[9px] text-muted">Copy link</div>
          <div className="px-2.5 py-1 rounded-md bg-teal text-white text-[9px] font-medium flex items-center gap-1">
            <Plus size={10} /> Add Asset
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-3 md:px-5 border-b border-edge shrink-0">
        {TABS.map(t => (
          <div
            key={t.label}
            className={`flex items-center gap-1 px-2.5 md:px-3 py-2 text-[9px] md:text-[10px] font-medium border-b-2 ${
              t.active ? 'border-teal text-teal' : 'border-transparent text-faint'
            }`}
          >
            <t.icon size={12} />
            {t.label}
          </div>
        ))}
      </div>

      {/* Board body: sidebar + canvas */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Palette sidebar */}
        <div className="hidden md:flex flex-col w-[150px] border-r border-edge shrink-0 bg-white">
          <div className="px-3 pt-3 pb-2">
            <div className="text-[10px] font-semibold text-ink">Add to canvas</div>
            <div className="text-[8px] text-faint">Click or drag any tile</div>
          </div>
          <div className="flex border-b border-edge">
            {['Items', 'Actions', 'Drawing'].map((tab, i) => (
              <div key={tab} className={`flex-1 text-center py-1.5 text-[8px] font-medium border-b-2 ${
                i === 0 ? 'border-teal text-teal' : 'border-transparent text-faint'
              }`}>{tab}</div>
            ))}
          </div>
          <div className="px-3 py-2">
            <div className="w-full py-1.5 rounded-md bg-teal text-white text-[9px] font-medium text-center mb-3">
              + New asset
            </div>
            <div className="text-[8px] text-faint uppercase tracking-wider mb-1.5">On board (6)</div>
            <div className="space-y-1.5">
              {PALETTE_ITEMS.map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                  <span className="text-[8px] text-ink/70 truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative" style={{
          backgroundColor: '#FAFAFA',
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}>
          {/* Drawing toolbar */}
          <div className="absolute top-3 right-3 flex flex-col items-center gap-0.5 bg-white rounded-xl border border-edge shadow-md px-1 py-1.5" style={{ zIndex: 5 }}>
            {DRAW_TOOLS.map((t, i) =>
              t.icon === null ? (
                <div key={i} className="w-5 h-px bg-edge my-0.5" />
              ) : (
                <div key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  t.active ? 'bg-teal text-white' : 'text-ink/50'
                }`}>
                  <t.icon size={13} weight="bold" />
                </div>
              )
            )}
          </div>

          {/* Horizontal flow: nodes + arrows in a line */}
          <div className="absolute inset-0 flex items-center px-4 md:px-6" style={{ zIndex: 2 }}>
            <div className="flex items-center w-full">
              {FLOW_NODES.map((node, idx) => {
                const isActive = activeNode === node.id;
                const Icon = node.icon;
                const isLast = idx === FLOW_NODES.length - 1;

                return (
                  <div key={node.id} className="flex items-center flex-1 min-w-0">
                    {/* Node */}
                    {node.type === 'card' ? (
                      <div className="relative shrink-0">
                        <div className={`w-[80px] md:w-[110px] rounded-2xl bg-white border-2 shadow-sm overflow-hidden transition-all duration-300 ${
                          isActive ? 'border-teal ring-2 ring-teal/30 scale-[1.04]' : 'border-edge'
                        }`}>
                          <div className={`h-10 md:h-14 bg-gradient-to-br ${node.thumb}`} />
                          <div className="px-1.5 md:px-2 pt-1 pb-1">
                            <div className="flex items-center gap-0.5 mb-0.5">
                              <span className="inline-flex items-center gap-0.5 px-1 py-px rounded bg-surface text-[6px] font-medium text-ink/50 border border-edge/50">
                                <Icon size={6} /> {node.typeLabel}
                              </span>
                            </div>
                            <div className="text-[7px] md:text-[9px] font-medium text-ink truncate">{node.label}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${node.dot}`} />
                              <span className="text-[6px] md:text-[7px] text-muted truncate">{node.status}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between px-1.5 md:px-2 py-1 border-t border-edge/50">
                            <span className="text-[6px] text-ink/30 flex items-center gap-0.5"><ChatCircle size={6} /> 2</span>
                            <span className="text-[6px] text-teal flex items-center gap-0.5"><Eye size={6} /> View</span>
                          </div>
                        </div>

                        {/* Pin comment */}
                        <AnimatePresence>
                          {showComment && node.id === 'fb-ad' && (
                            <motion.div
                              initial={{ opacity: 0, y: 6, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 4, scale: 0.95 }}
                              transition={{ duration: 0.3 }}
                              className="absolute -top-9 md:-top-10 left-1 bg-surface-dark text-white px-2 py-1 rounded-lg shadow-lg whitespace-nowrap"
                              style={{ zIndex: 10 }}
                            >
                              <span className="text-[7px] md:text-[8px]">Headline needs more punch</span>
                              <div className="absolute bottom-0 left-3 w-1.5 h-1.5 bg-surface-dark rotate-45 translate-y-0.5" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <div className="relative shrink-0 flex flex-col items-center gap-0.5">
                        <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full bg-white border-2 flex items-center justify-center shadow-sm transition-all duration-300 ${
                          isActive ? 'border-teal ring-2 ring-teal/30' : 'border-edge'
                        }`}>
                          <Icon size={14} className={isActive ? 'text-teal' : 'text-ink/50'} />
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${node.dot}`} />
                        </div>
                        <span className="text-[6px] md:text-[8px] font-medium text-ink/60 whitespace-nowrap">{node.label}</span>
                      </div>
                    )}

                    {/* Arrow connector */}
                    {!isLast && (
                      <div className="flex-1 flex items-center min-w-[8px] mx-1 md:mx-1.5">
                        <div className="flex-1 h-px bg-ink/20" />
                        <svg width="6" height="8" viewBox="0 0 6 8" className="shrink-0 text-ink/20">
                          <path d="M0,0 L6,4 L0,8" fill="currentColor" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sticky notes — below the flow */}
          {STICKIES.map((note, i) => (
            <div key={i} className="absolute" style={{ left: `${note.x}%`, top: `${note.y}%`, zIndex: 2 }}>
              <div className={`w-[64px] md:w-[84px] p-1.5 md:p-2 rounded-md md:rounded-lg ${note.color} shadow-sm border border-black/5`}>
                <span className="text-[6px] md:text-[8px] text-ink/70 font-medium whitespace-pre-line leading-tight">{note.text}</span>
              </div>
            </div>
          ))}

          {/* Animated cursor */}
          {!reduce && (
            <motion.div
              className="absolute pointer-events-none"
              style={{ zIndex: 20 }}
              animate={{ left: CURSOR_PATH.left, top: CURSOR_PATH.top }}
              transition={{
                duration: TOTAL_DURATION,
                repeat: Infinity,
                times: CURSOR_TIMES,
                ease: 'easeInOut',
              }}
            >
              <svg width="16" height="20" viewBox="0 0 18 22" fill="none" className="drop-shadow-md">
                <path d="M1 1L1 18.5L5.5 14L10.5 21L13 19.5L8 12.5L14 11.5L1 1Z" fill="white" stroke="#1E2432" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <AnimatePresence>
                {(scene === 1 || scene === 3 || scene === 4) && (
                  <motion.div
                    key={scene}
                    initial={{ scale: 0.3, opacity: 0.5 }}
                    animate={{ scale: 2, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute top-0 left-0 w-4 h-4 rounded-full bg-teal/30"
                  />
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* MiniMap */}
          <div className="absolute bottom-2 right-2 w-16 h-10 rounded bg-white/80 border border-edge/40 shadow-sm p-1" style={{ zIndex: 3 }}>
            <div className="w-full h-full rounded bg-surface/40 relative flex items-center px-1 gap-[3px]">
              {FLOW_NODES.map(n => (
                <div key={n.id} className={`w-1 h-1 rounded-full ${n.type === 'card' ? 'bg-teal/60' : 'bg-teal/40'}`} />
              ))}
            </div>
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-2 left-2 flex flex-col gap-0.5 bg-white rounded-md border border-edge shadow-sm" style={{ zIndex: 3 }}>
            <div className="w-6 h-6 flex items-center justify-center text-ink/40 text-xs font-bold border-b border-edge/50">+</div>
            <div className="w-6 h-6 flex items-center justify-center text-ink/40 text-xs font-bold">&minus;</div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Asset detail view (cursor "clicks" into an asset) ───────────── */

function AssetDetailView() {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-5 py-2.5 border-b border-edge shrink-0">
        <div className="flex items-center gap-2">
          <ArrowLeft size={14} className="text-faint" />
          <span className="text-[10px] md:text-xs font-semibold">Facebook Ad</span>
          <span className="px-1.5 py-0.5 rounded bg-surface text-[7px] font-medium text-ink/60 border border-edge/50">
            <Megaphone size={7} className="inline mr-0.5" /> Ad
          </span>
          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] font-medium bg-emerald-50 text-emerald-600">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Approved
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="px-2 py-1 rounded-md border border-edge text-[9px] text-muted">v2</div>
          <div className="px-2 py-1 rounded-md border border-edge text-[9px] text-muted">Share</div>
        </div>
      </div>

      {/* Content: image + comments panel */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Image viewport */}
        <div className="flex-1 flex items-center justify-center bg-[#FAFAFA] p-4 relative">
          <div className="w-[75%] max-w-[320px] aspect-[4/5] rounded-lg bg-gradient-to-br from-teal-200 via-teal-100 to-cyan-100 shadow-md relative">
            {/* Pin markers */}
            <div className="absolute top-[15%] left-[25%] w-5 h-5 rounded-full bg-teal text-white text-[8px] font-bold flex items-center justify-center shadow-sm border-2 border-white">1</div>
            <div className="absolute top-[45%] left-[55%] w-5 h-5 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center shadow-sm border-2 border-white">2</div>
            <div className="absolute top-[70%] right-[20%] w-5 h-5 rounded-full bg-teal text-white text-[8px] font-bold flex items-center justify-center shadow-sm border-2 border-white opacity-50">3</div>
          </div>
        </div>

        {/* Comments panel */}
        <div className="hidden md:flex flex-col w-[170px] border-l border-edge bg-white shrink-0">
          <div className="px-3 py-2 border-b border-edge">
            <div className="text-[10px] font-semibold">Comments (3)</div>
          </div>
          <div className="flex-1 overflow-hidden px-3 py-2 space-y-2.5">
            {[
              { num: 1, name: 'Jessica T.', text: 'Headline needs more punch. Try the bold variant.', time: '2m ago', resolved: false },
              { num: 2, name: 'Marcus L.', text: 'CTA button colour clashes with the background', time: '1h ago', resolved: false },
              { num: 3, name: 'Anna K.', text: 'Logo placement looks great here', time: '3h ago', resolved: true },
            ].map(c => (
              <div key={c.num} className={`text-[8px] ${c.resolved ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-1 mb-0.5">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[6px] font-bold ${
                    c.resolved ? 'bg-muted' : c.num === 1 ? 'bg-teal' : 'bg-amber-500'
                  }`}>{c.num}</div>
                  <span className="font-semibold text-ink">{c.name}</span>
                  <span className="text-faint ml-auto">{c.time}</span>
                </div>
                <p className="text-ink/70 pl-[18px] leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
