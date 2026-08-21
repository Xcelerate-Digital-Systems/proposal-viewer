'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { X, Trash2, Bold, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

const FunnelLinkPicker = lazy(() => import('@/components/admin/funnels/board/FunnelLinkPicker'));
const NodeMessageEditor = lazy(() => import('@/components/admin/funnels/board/NodeMessageEditor'));
const NodeMessageModal = lazy(() => import('@/components/admin/funnels/board/NodeMessageModal'));
const RolePicker = lazy(() => import('@/components/admin/funnels/board/RolePicker'));
const PlatformPicker = lazy(() => import('@/components/admin/funnels/board/PlatformPicker'));
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { FeedbackWaitUnit, FunnelTab, FunnelRole } from '@/lib/supabase';
import {
  FUNNEL_COLOR_PRESETS, messageKindForShape, parseNodeMessage, hasMessageContent,
  type FunnelNodeMessage,
} from '@/lib/types/funnel';
import {
  parseDecisionContent, serializeDecisionContent,
  parseWaitContent, serializeWaitContent,
  parseActionContent, serializeActionContent,
} from '@/components/admin/feedback/board/nodes/ShapeNode';
import { parseTextContent, serializeTextContent } from '@/components/admin/feedback/board/nodes/TextShape';
import { parseDescriptionBoxContent, serializeDescriptionBoxContent } from '@/components/admin/feedback/board/nodes/DescriptionBoxShape';

export interface BoardShape {
  id: string;
  shape_type: string;
  content: string | null;
  color: string;
  stroke_width: number;
  dashed: boolean;
  font_size: number | null;
  description?: string | null;
}

interface Props<T extends BoardShape> {
  shape: T;
  onUpdate: (patch: Partial<T>) => void;
  onDelete: () => void;
  onClose: () => void;
  funnelLink?: {
    currentFunnelId: string;
    linkedFunnelId: string | null;
    onLink: (funnelId: string | null) => void;
    tabs?: FunnelTab[];
    currentTabId?: string | null;
    linkedTabId?: string | null;
    onLinkTab?: (tabId: string | null) => void;
  };
  /** Funnel board only — enables the email/SMS content editor on
   *  message-capable shape types. The feedback whiteboard omits this, so the
   *  section (and its lazy chunk) never appear there. */
  nodeMessage?: {
    raw: unknown;
    onChange: (next: FunnelNodeMessage | null) => void;
  };
  /** Funnel board only — owner assignment. Roles are plain labels, never
   *  team members. Omitted on the feedback whiteboard. */
  /** Funnel board only — marks which system this node runs in. */
  nodePlatform?: {
    platform: string | null;
    onChange: (slug: string | null) => void;
  };
  nodeRole?: {
    roles: FunnelRole[];
    roleId: string | null;
    onAssign: (roleId: string | null) => void;
    onCreate: (name: string) => Promise<FunnelRole | null>;
    onRecolour: (roleId: string, color: string) => void;
  };
}

const SHAPE_TYPE_LABELS: Record<string, string> = {
  rectangle: 'Rectangle', ellipse: 'Ellipse', arrow: 'Arrow', line: 'Line', text: 'Text',
  decision: 'Decision', wait: 'Wait',
  call: 'Call', meeting: 'Meeting', automation: 'Automation', goal: 'Goal',
  button_click: 'Button Click', form_submit: 'Form Submit', video_play: 'Video Play',
  scroll_depth: 'Scroll Depth', purchase: 'Purchase', add_to_cart: 'Add to Cart',
  subscribe: 'Subscribe', custom_event: 'Custom Event', page_view: 'Page View',
  time_on_page: 'Time on Page', exit_intent: 'Exit Intent', refund: 'Refund',
  download: 'Download', share: 'Share', login: 'Login',
  sms_notification: 'SMS Notification', email_notification: 'Email Notification',
  ghl_notification: 'HighLevel Notification', google_sheet: 'Google Sheet', webhook: 'Webhook',
  form_completed: 'Form Completed', schedule_meeting: 'Schedule Meeting', deal_won: 'Deal Won', deal_lost: 'Deal Lost',
  ghl_appointment: 'GHL Appointment', ghl_order: 'GHL Order',
  ghl_opportunity: 'GHL Opportunity', ghl_opportunity_won: 'GHL Opportunity Won',
  on_site_visit: 'On-Site Visit', send_quote: 'Send Quote',
  send_google_review: 'Send Google Review', add_to_referral_program: 'Add to Referral Program',
  description_box: 'Description Box',
};

const STROKE_WIDTHS = [1, 2, 3, 4, 6];
const WAIT_UNITS: { value: string; label: string }[] = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
];

function getEditableLabel(shape: BoardShape): string {
  if (shape.shape_type === 'decision') return parseDecisionContent(shape.content).question;
  if (shape.shape_type === 'wait') return parseWaitContent(shape.content).label ?? '';
  if (shape.shape_type === 'text') return parseTextContent(shape.content).text;
  if (shape.shape_type === 'description_box') return parseDescriptionBoxContent(shape.content).title;
  if (shape.shape_type === 'rectangle' || shape.shape_type === 'ellipse') {
    return shape.content || '';
  }
  return parseActionContent(shape.content).label ?? '';
}

function setEditableLabel(shape: BoardShape, next: string): string | null {
  const trimmed = next.trim();
  if (shape.shape_type === 'decision') {
    const cur = parseDecisionContent(shape.content);
    return serializeDecisionContent({ ...cur, question: trimmed || 'Decision?' });
  }
  if (shape.shape_type === 'wait') {
    const cur = parseWaitContent(shape.content);
    return serializeWaitContent({ ...cur, label: trimmed || null });
  }
  if (shape.shape_type === 'text') {
    const cur = parseTextContent(shape.content);
    return serializeTextContent({ ...cur, text: trimmed });
  }
  if (shape.shape_type === 'description_box') {
    const cur = parseDescriptionBoxContent(shape.content);
    return serializeDescriptionBoxContent({ ...cur, title: trimmed });
  }
  if (shape.shape_type === 'rectangle' || shape.shape_type === 'ellipse') {
    return trimmed || null;
  }
  return serializeActionContent({ label: trimmed || null });
}

const TEXT_BG_COLORS = [
  { value: '', label: 'None' },
  { value: '#ffffff', label: 'White' },
  { value: '#FEF3C7', label: 'Yellow' },
  { value: '#DCFCE7', label: 'Green' },
  { value: '#DBEAFE', label: 'Blue' },
  { value: '#EDE9FE', label: 'Purple' },
  { value: '#FCE7F3', label: 'Pink' },
  { value: '#FFEDD5', label: 'Orange' },
  { value: '#F1F5F9', label: 'Slate' },
  { value: '#2B2B2B', label: 'Dark' },
  { value: '#017C87', label: 'Teal' },
];

export default function ShapeSideDrawer<T extends BoardShape>({ shape, onUpdate, onDelete, onClose, funnelLink, nodeMessage, nodeRole, nodePlatform }: Props<T>) {
  const confirm = useConfirm();
  const [messagePreviewOpen, setMessagePreviewOpen] = useState(false);
  const messageKind = nodeMessage ? messageKindForShape(shape.shape_type) : null;
  const parsedMessage = nodeMessage ? parseNodeMessage(nodeMessage.raw) : null;
  const [content, setContent] = useState(() => getEditableLabel(shape));
  useEffect(() => { setContent(getEditableLabel(shape)); }, [shape.id, shape.content]);
  const textStyle = shape.shape_type === 'text' ? parseTextContent(shape.content) : null;
  const isDescBox = shape.shape_type === 'description_box';
  const descBoxData = isDescBox ? parseDescriptionBoxContent(shape.content) : null;
  const [descBody, setDescBody] = useState(() => descBoxData?.body ?? '');
  useEffect(() => { if (isDescBox) setDescBody(parseDescriptionBoxContent(shape.content).body); }, [shape.id, shape.content, isDescBox]);

  const commitContent = () => {
    const next = setEditableLabel(shape, content);
    if (next !== (shape.content || null)) onUpdate({ content: next } as Partial<T>);
  };

  const commitDescBody = () => {
    if (!descBoxData) return;
    const trimmed = descBody.trim();
    if (trimmed !== descBoxData.body) {
      const next = serializeDescriptionBoxContent({ ...descBoxData, body: trimmed });
      onUpdate({ content: next } as Partial<T>);
    }
  };

  const [nodeDesc, setNodeDesc] = useState(shape.description || '');
  useEffect(() => { setNodeDesc(shape.description || ''); }, [shape.id]);
  const commitNodeDesc = () => {
    const next = nodeDesc.trim() || null;
    if (next !== (shape.description || null)) onUpdate({ description: next } as Partial<T>);
  };

  const updateTextStyle = (patch: Partial<{ bold: boolean; bgColor: string; align: 'left' | 'center' | 'right' }>) => {
    if (!textStyle) return;
    const next = serializeTextContent({ ...textStyle, ...patch });
    onUpdate({ content: next } as Partial<T>);
  };

  const typeLabel = SHAPE_TYPE_LABELS[shape.shape_type] || 'Shape';
  const isLabelLike = shape.shape_type !== 'text' && shape.shape_type !== 'rectangle' && shape.shape_type !== 'ellipse' && shape.shape_type !== 'description_box';
  const hasStroke = shape.shape_type === 'rectangle' || shape.shape_type === 'ellipse'
    || shape.shape_type === 'arrow' || shape.shape_type === 'line';
  const isWait = shape.shape_type === 'wait';
  const waitData = isWait ? parseWaitContent(shape.content) : null;

  return (
    <motion.aside
      data-side-drawer
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="absolute top-0 right-0 h-full w-[340px] bg-white border-l border-edge shadow-xl flex flex-col z-30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white text-2xs font-semibold"
            style={{ backgroundColor: shape.color || '#2B2B2B' }}
          >
            {typeLabel.charAt(0)}
          </div>
          <span className="text-xs font-semibold text-ink truncate">{typeLabel}</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-surface flex items-center justify-center transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {isDescBox ? (
          <>
            <Field label="Title">
              <input
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onBlur={commitContent}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                placeholder="Box title"
                className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
              />
            </Field>
            <Field label="Description">
              <textarea
                value={descBody}
                onChange={(e) => setDescBody(e.target.value)}
                onBlur={commitDescBody}
                rows={4}
                placeholder="Add a description…"
                className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 resize-y"
              />
            </Field>
          </>
        ) : (
        <Field label={shape.shape_type === 'decision' ? 'Question' : isLabelLike ? 'Label' : 'Content'}>
          {isLabelLike ? (
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={commitContent}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              placeholder={shape.shape_type === 'decision' ? 'Decision?' : typeLabel}
              className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={commitContent}
              rows={3}
              placeholder="Type any text…"
              className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 resize-y"
            />
          )}
        </Field>
        )}

        <div>
          <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted mb-2">Color</h4>
          <div className="flex flex-wrap gap-1.5">
            {FUNNEL_COLOR_PRESETS.map((hex) => {
              const active = shape.color === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onUpdate({ color: hex } as Partial<T>)}
                  className={`w-6 h-6 rounded-lg border transition-transform ${active ? 'border-ink scale-110' : 'border-edge'}`}
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              );
            })}
            <input
              type="color"
              value={shape.color || '#2B2B2B'}
              onChange={(e) => onUpdate({ color: e.target.value } as Partial<T>)}
              className="w-6 h-6 rounded-lg border border-edge cursor-pointer"
              title="Custom color"
            />
          </div>
        </div>

        <Field label="Node description">
          <textarea
            value={nodeDesc}
            onChange={(e) => setNodeDesc(e.target.value)}
            onBlur={commitNodeDesc}
            rows={3}
            placeholder="Add a description to show below this node…"
            className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 resize-none"
          />
          <p className="text-2xs text-muted/70 mt-0.5 leading-snug">
            Shows as a card below the node on the canvas. Leave empty to hide.
          </p>
        </Field>

        {nodePlatform && (
          <Suspense fallback={null}>
            <PlatformPicker platform={nodePlatform.platform} onChange={nodePlatform.onChange} />
          </Suspense>
        )}

        {nodeRole && (
          <Suspense fallback={null}>
            <RolePicker
              roles={nodeRole.roles}
              roleId={nodeRole.roleId}
              onAssign={nodeRole.onAssign}
              onCreate={nodeRole.onCreate}
              onRecolour={nodeRole.onRecolour}
            />
          </Suspense>
        )}

        {messageKind && nodeMessage && (
          <Suspense fallback={null}>
            <NodeMessageEditor
              nodeId={shape.id}
              kind={messageKind}
              message={parsedMessage}
              onChange={nodeMessage.onChange}
              onPreview={() => setMessagePreviewOpen(true)}
            />
          </Suspense>
        )}

        {funnelLink && (
          <Suspense fallback={null}>
            <FunnelLinkPicker
              currentFunnelId={funnelLink.currentFunnelId}
              linkedFunnelId={funnelLink.linkedFunnelId}
              onLink={funnelLink.onLink}
              tabs={funnelLink.tabs}
              currentTabId={funnelLink.currentTabId}
              linkedTabId={funnelLink.linkedTabId}
              onLinkTab={funnelLink.onLinkTab}
            />
          </Suspense>
        )}

        {isWait && waitData && (
          <div className="space-y-2">
            <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted">Wait duration</h4>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={9999}
                value={waitData.duration}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(9999, Number(e.target.value) || 1));
                  onUpdate({ content: serializeWaitContent({ ...waitData, duration: n }) } as Partial<T>);
                }}
                className="w-20 px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
              />
              <select
                value={waitData.unit}
                onChange={(e) => {
                  onUpdate({ content: serializeWaitContent({ ...waitData, unit: e.target.value as FeedbackWaitUnit }) } as Partial<T>);
                }}
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 bg-white"
              >
                {WAIT_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {hasStroke && (
        <div>
          <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted mb-2">Stroke</h4>
          <div className="flex items-center gap-1.5">
            {STROKE_WIDTHS.map((w) => {
              const active = shape.stroke_width === w;
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => onUpdate({ stroke_width: w } as Partial<T>)}
                  className={`h-8 px-2.5 rounded-lg border text-detail flex items-center justify-center transition-colors ${
                    active ? 'border-teal bg-teal/10 text-teal' : 'border-edge text-ink/70 hover:bg-surface'
                  }`}
                  title={`${w}px`}
                >
                  {w}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onUpdate({ dashed: !shape.dashed } as Partial<T>)}
              className={`ml-auto h-8 px-2.5 rounded-lg border text-detail flex items-center gap-1 transition-colors ${
                shape.dashed ? 'border-teal bg-teal/10 text-teal' : 'border-edge text-ink/70 hover:bg-surface'
              }`}
            >
              Dashed
            </button>
          </div>
        </div>
        )}

        {(shape.shape_type === 'text' || shape.shape_type === 'rectangle' || shape.shape_type === 'ellipse') && (
          <Field label="Font size">
            <input
              type="number"
              min={8}
              max={64}
              value={shape.font_size ?? 14}
              onChange={(e) => {
                const n = Number(e.target.value);
                onUpdate({ font_size: Number.isFinite(n) ? n : null } as Partial<T>);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          </Field>
        )}

        {textStyle && (
          <>
            <div>
              <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted mb-2">Text style</h4>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => updateTextStyle({ bold: !textStyle.bold })}
                  className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors ${
                    textStyle.bold ? 'border-teal bg-teal/10 text-teal' : 'border-edge text-ink/70 hover:bg-surface'
                  }`}
                  title="Bold"
                >
                  <Bold size={14} strokeWidth={2.4} />
                </button>
                <span className="w-px h-5 bg-edge mx-0.5" />
                <button
                  type="button"
                  onClick={() => updateTextStyle({ align: 'left' })}
                  className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors ${
                    (!textStyle.align || textStyle.align === 'left') ? 'border-teal bg-teal/10 text-teal' : 'border-edge text-ink/70 hover:bg-surface'
                  }`}
                  title="Align left"
                >
                  <AlignLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => updateTextStyle({ align: 'center' })}
                  className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors ${
                    textStyle.align === 'center' ? 'border-teal bg-teal/10 text-teal' : 'border-edge text-ink/70 hover:bg-surface'
                  }`}
                  title="Align center"
                >
                  <AlignCenter size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => updateTextStyle({ align: 'right' })}
                  className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors ${
                    textStyle.align === 'right' ? 'border-teal bg-teal/10 text-teal' : 'border-edge text-ink/70 hover:bg-surface'
                  }`}
                  title="Align right"
                >
                  <AlignRight size={14} />
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted mb-2">Background</h4>
              <div className="flex flex-wrap gap-1.5">
                {TEXT_BG_COLORS.map((c) => {
                  const active = (textStyle.bgColor || '') === c.value;
                  return (
                    <button
                      key={c.value || 'none'}
                      type="button"
                      onClick={() => updateTextStyle({ bgColor: c.value })}
                      className={`w-6 h-6 rounded-lg border transition-transform ${
                        active ? 'border-ink scale-110' : 'border-edge'
                      } ${!c.value ? 'bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:8px_8px]' : ''}`}
                      style={c.value ? { backgroundColor: c.value } : undefined}
                      title={c.label}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-edge">
        <button
          onClick={async () => {
            const ok = await confirm({ message: `Delete this ${typeLabel.toLowerCase()}?`, destructive: true, confirmLabel: 'Delete' });
            if (ok) onDelete();
          }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 text-xs text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <Trash2 size={13} /> Delete {typeLabel.toLowerCase()}
        </button>
      </div>

      {messagePreviewOpen && parsedMessage && hasMessageContent(parsedMessage) && (
        <Suspense fallback={null}>
          <NodeMessageModal
            message={parsedMessage}
            title={typeLabel}
            onClose={() => setMessagePreviewOpen(false)}
          />
        </Suspense>
      )}
    </motion.aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-2xs uppercase tracking-wider font-semibold text-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}
