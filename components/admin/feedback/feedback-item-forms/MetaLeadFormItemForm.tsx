'use client';

import { useState, useRef, useMemo } from 'react';
import {
  X, Upload, Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Zap,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import MetaLeadFormMockupPreview, {
  type MetaLeadFormPage,
} from '@/components/admin/feedback/MetaLeadFormMockupPreview';
import {
  type MetaLeadFormData,
  type MetaLeadFormQuestion,
  type MetaLeadFormQuestionType,
  type MetaLeadFormCompletionScreen,
  type MetaLeadFormCompletionLogic,
  isMetaLeadFormPrefillType,
} from '@/lib/types/feedback';
import FormActions from './FormActions';

interface MetaLeadFormItemFormProps {
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onUploadAsset: (file: File) => Promise<string | null>;
  onBack: () => void;
  onCancel: () => void;
  uploading: boolean;
  onPreviewChange?: (visible: boolean) => void;
}

type QuestionTypeMeta = {
  value: MetaLeadFormQuestionType;
  label: string;
  group: 'custom' | 'user_info' | 'work_info';
};

const QUESTION_TYPES: QuestionTypeMeta[] = [
  // Custom
  { value: 'short_answer',    label: 'Short answer',     group: 'custom' },
  { value: 'multiple_choice', label: 'Multiple choice',  group: 'custom' },
  // User info
  { value: 'email',           label: 'Email',            group: 'user_info' },
  { value: 'phone',           label: 'Phone number',     group: 'user_info' },
  { value: 'full_name',       label: 'Full name',        group: 'user_info' },
  { value: 'first_name',      label: 'First name',       group: 'user_info' },
  { value: 'last_name',       label: 'Last name',        group: 'user_info' },
  { value: 'street_address',  label: 'Street address',   group: 'user_info' },
  { value: 'city',            label: 'City',             group: 'user_info' },
  { value: 'state',           label: 'State',            group: 'user_info' },
  { value: 'province',        label: 'Province',         group: 'user_info' },
  { value: 'country',         label: 'Country',          group: 'user_info' },
  { value: 'post_code',       label: 'Post code',        group: 'user_info' },
  { value: 'date_of_birth',   label: 'Date of birth',    group: 'user_info' },
  { value: 'gender',          label: 'Gender',           group: 'user_info' },
  // Work info
  { value: 'company_name',    label: 'Company name',     group: 'work_info' },
  { value: 'job_title',       label: 'Job title',        group: 'work_info' },
  { value: 'work_email',      label: 'Work email',       group: 'work_info' },
  { value: 'work_phone',      label: 'Work phone',       group: 'work_info' },
];

const CUSTOM_TYPES = QUESTION_TYPES.filter((t) => t.group === 'custom');
const USER_INFO_TYPES = QUESTION_TYPES.filter((t) => t.group === 'user_info');
const WORK_INFO_TYPES = QUESTION_TYPES.filter((t) => t.group === 'work_info');

function newQuestion(type: MetaLeadFormQuestionType = 'short_answer'): MetaLeadFormQuestion {
  return {
    id: crypto.randomUUID(),
    type,
    label: '',
    options: type === 'multiple_choice' ? ['Option 1', 'Option 2'] : undefined,
    required: true,
  };
}

function isPrefillTypeFor(type: MetaLeadFormQuestionType): boolean {
  return isMetaLeadFormPrefillType(type);
}

function newScreen(headline = 'Thanks, you’re all set.'): MetaLeadFormCompletionScreen {
  return {
    id: crypto.randomUUID(),
    headline,
    description: 'You can close this form now or visit our website to learn more.',
    button_label: 'View Website',
    button_url: '',
  };
}

export default function MetaLeadFormItemForm({
  onSubmit, onUploadAsset, onBack, onCancel, uploading, onPreviewChange,
}: MetaLeadFormItemFormProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [introHeadline, setIntroHeadline] = useState('');
  const [introDescription, setIntroDescription] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [cta, setCta] = useState('Continue');

  const [questions, setQuestions] = useState<MetaLeadFormQuestion[]>([
    { ...newQuestion('email'), label: 'Email' },
    { ...newQuestion('full_name'), label: 'Full name' },
  ]);
  const [privacyUrl, setPrivacyUrl] = useState('');
  const [privacyLabel, setPrivacyLabel] = useState('');

  const [screens, setScreens] = useState<MetaLeadFormCompletionScreen[]>([newScreen()]);
  const [logic, setLogic] = useState<MetaLeadFormCompletionLogic | null>(null);

  const [showPreview, setShowPreview] = useState(false);
  const [previewPage, setPreviewPage] = useState<MetaLeadFormPage>('intro');
  const [previewScreenId, setPreviewScreenId] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const togglePreview = () => {
    const next = !showPreview;
    setShowPreview(next);
    onPreviewChange?.(next);
  };

  const data: MetaLeadFormData = useMemo(
    () => ({
      cover_url: coverPreview,
      intro_headline: introHeadline,
      intro_description: introDescription,
      business_name: businessName,
      cta,
      questions,
      privacy_policy_url: privacyUrl,
      privacy_policy_label: privacyLabel,
      completion_screens: screens,
      completion_logic: logic,
    }),
    [
      coverPreview, introHeadline, introDescription, businessName, cta,
      questions, privacyUrl, privacyLabel, screens, logic,
    ]
  );

  const customQuestions = useMemo(
    () => questions.filter((q) => !isMetaLeadFormPrefillType(q.type)),
    [questions]
  );
  const prefillQuestions = useMemo(
    () => questions.filter((q) => isMetaLeadFormPrefillType(q.type)),
    [questions]
  );
  const multipleChoiceQuestions = useMemo(
    () => questions.filter((q) => q.type === 'multiple_choice'),
    [questions]
  );

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      toast.error('Please select an image file'); return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB'); return;
    }
    setCoverFile(selected);
    const reader = new FileReader();
    reader.onload = (ev) => setCoverPreview(ev.target?.result as string);
    reader.readAsDataURL(selected);
  };

  const clearCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateQuestion = (id: string, patch: Partial<MetaLeadFormQuestion>) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };
  const removeQuestion = (id: string) => {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
    setLogic((l) => (l && l.question_id === id ? null : l));
  };
  /** Swap with the previous/next question that belongs to the same group
   *  (custom or prefill). This keeps section ordering stable. */
  const moveWithinGroup = (id: string, dir: -1 | 1) => {
    setQuestions((qs) => {
      const idx = qs.findIndex((q) => q.id === id);
      if (idx === -1) return qs;
      const target = qs[idx];
      const isPrefill = isPrefillTypeFor(target.type);
      // Find next neighbour in same group
      let swapIdx = -1;
      const step = dir;
      for (let i = idx + step; i >= 0 && i < qs.length; i += step) {
        if (isPrefillTypeFor(qs[i].type) === isPrefill) { swapIdx = i; break; }
      }
      if (swapIdx === -1) return qs;
      const copy = [...qs];
      [copy[idx], copy[swapIdx]] = [copy[swapIdx], copy[idx]];
      return copy;
    });
  };
  const addCustomQuestion = () => setQuestions((qs) => [...qs, newQuestion('short_answer')]);
  const addPrefillQuestion = () => setQuestions((qs) => [...qs, newQuestion('email')]);

  const updateScreen = (id: string, patch: Partial<MetaLeadFormCompletionScreen>) => {
    setScreens((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const addScreen = () => {
    setScreens((ss) => [...ss, newScreen(`Screen ${ss.length + 1}`)]);
  };
  const removeScreen = (id: string) => {
    setScreens((ss) => {
      if (ss.length <= 1) return ss;
      return ss.filter((s) => s.id !== id);
    });
    // Strip references in logic.
    setLogic((l) => {
      if (!l) return l;
      if (l.default_screen_id === id) return null;
      const rules = l.rules.filter((r) => r.screen_id !== id);
      return { ...l, rules };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!introHeadline.trim()) {
      toast.error('Intro headline is required'); return;
    }
    if (questions.length === 0) {
      toast.error('Add at least one question'); return;
    }

    setSubmitting(true);
    let coverUrl: string | null = null;
    if (coverFile) {
      coverUrl = await onUploadAsset(coverFile);
      if (!coverUrl) { setSubmitting(false); return; }
    }

    const payload: Record<string, unknown> = {
      title: title.trim(),
      type: 'meta_lead_form',
      meta_lead_form_data: {
        cover_url: coverUrl,
        intro_headline: introHeadline.trim(),
        intro_description: introDescription.trim(),
        business_name: businessName.trim() || null,
        cta: cta.trim() || 'Continue',
        questions: questions.map((q) => ({
          ...q,
          label: q.label.trim() || labelFallback(q.type),
          options: q.type === 'multiple_choice'
            ? (q.options || []).map((o) => o.trim()).filter(Boolean)
            : undefined,
        })),
        privacy_policy_url: privacyUrl.trim(),
        privacy_policy_label: privacyLabel.trim(),
        completion_screens: screens.map((s) => ({
          ...s,
          headline: s.headline.trim(),
          description: s.description.trim(),
          button_label: s.button_label.trim(),
          button_url: s.button_url.trim(),
        })),
        completion_logic: logic && logic.rules.length > 0 ? logic : null,
      } satisfies MetaLeadFormData,
    };

    await onSubmit(payload);
    setSubmitting(false);
  };

  const busy = uploading || submitting;

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex">
      <div className={`${showPreview ? 'w-1/2 border-r border-gray-200' : 'w-full'} p-6 space-y-4 overflow-y-auto`}>
        <Section title="Item">
          <Field label="Item Title *">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New Plumbing Lead Form" className={inputCls} autoFocus />
          </Field>
          <Field label="Business Name">
            <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Shown on the form (e.g. Acme Plumbing)" className={inputCls} />
          </Field>
        </Section>

        <Section title="Intro Page" onJump={() => setPreviewPage('intro')}>
          <Field label="Cover Image">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
            {coverPreview ? (
              <div className="relative">
                <img src={coverPreview} alt="Cover" className="w-full max-h-[160px] object-cover rounded-lg border border-gray-200 bg-gray-50" />
                <button type="button" onClick={clearCover}
                  className="absolute top-2 right-2 p-1 bg-white/90 rounded-full border border-gray-200 text-gray-500 hover:text-red-500">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-teal hover:bg-teal/5 transition-colors">
                <Upload size={20} className="mx-auto mb-1.5 text-gray-400" />
                <p className="text-xs font-medium text-gray-600">Upload cover image</p>
                <p className="text-2xs text-gray-400 mt-0.5">1.91:1 ratio recommended</p>
              </button>
            )}
          </Field>
          <Field label="Headline *">
            <input type="text" value={introHeadline} onChange={(e) => setIntroHeadline(e.target.value)}
              placeholder="Get a Free Quote" className={inputCls} />
          </Field>
          <Field label="Description">
            <textarea value={introDescription} onChange={(e) => setIntroDescription(e.target.value)}
              rows={3} placeholder="Short pitch describing the offer or what the user gets…"
              className={`${inputCls} resize-y min-h-[72px]`} />
          </Field>
          <Field label="CTA Button Text">
            <input type="text" value={cta} onChange={(e) => setCta(e.target.value)}
              placeholder="Continue" className={inputCls} />
          </Field>
        </Section>

        <Section
          title={`Custom Questions (${customQuestions.length})`}
          onJump={() => setPreviewPage('custom_questions')}
        >
          <p className="text-[11px] text-gray-500 -mt-1">
            Shown first on the form. Use these for qualifying questions specific to your offer.
          </p>
          <div className="space-y-2">
            {customQuestions.map((q) => {
              const idx = customQuestions.findIndex((x) => x.id === q.id);
              return (
                <QuestionCard
                  key={q.id}
                  question={q}
                  positionLabel={`Q${idx + 1}`}
                  typeOptions={CUSTOM_TYPES}
                  isFirst={idx === 0}
                  isLast={idx === customQuestions.length - 1}
                  onUpdate={(patch) => updateQuestion(q.id, patch)}
                  onMove={(dir) => moveWithinGroup(q.id, dir)}
                  onRemove={() => removeQuestion(q.id)}
                />
              );
            })}
            <button type="button" onClick={addCustomQuestion}
              className="w-full px-3 py-2 rounded-xl text-[13px] font-medium text-teal hover:bg-teal/5 border border-dashed border-gray-300 hover:border-teal transition-colors inline-flex items-center justify-center gap-1.5">
              <Plus size={14} /> Add custom question
            </button>
          </div>
        </Section>

        <Section
          title={`General Contact Details (${prefillQuestions.length})`}
          onJump={() => setPreviewPage('contact_info')}
        >
          <p className="text-[11px] text-gray-500 -mt-1">
            Pre-fill fields shown after the custom questions. Meta autofills these from the user's profile.
          </p>
          <div className="space-y-2">
            {prefillQuestions.map((q) => {
              const idx = prefillQuestions.findIndex((x) => x.id === q.id);
              return (
                <QuestionCard
                  key={q.id}
                  question={q}
                  positionLabel={`F${idx + 1}`}
                  typeOptions={[
                    { groupLabel: 'User Info', items: USER_INFO_TYPES },
                    { groupLabel: 'Work Info', items: WORK_INFO_TYPES },
                  ]}
                  isFirst={idx === 0}
                  isLast={idx === prefillQuestions.length - 1}
                  onUpdate={(patch) => updateQuestion(q.id, patch)}
                  onMove={(dir) => moveWithinGroup(q.id, dir)}
                  onRemove={() => removeQuestion(q.id)}
                />
              );
            })}
            <button type="button" onClick={addPrefillQuestion}
              className="w-full px-3 py-2 rounded-xl text-[13px] font-medium text-teal hover:bg-teal/5 border border-dashed border-gray-300 hover:border-teal transition-colors inline-flex items-center justify-center gap-1.5">
              <Plus size={14} /> Add contact field
            </button>
          </div>
          {prefillQuestions.length === 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded">
              No contact fields yet — at minimum add an email or phone so leads are reachable.
            </p>
          )}
        </Section>

        <Section title="Privacy" onJump={() => setPreviewPage('privacy')}>
          <Field label="Privacy Policy URL">
            <input type="url" value={privacyUrl} onChange={(e) => setPrivacyUrl(e.target.value)}
              placeholder="https://example.com/privacy" className={inputCls} />
          </Field>
          <Field label="Privacy Link Label">
            <input type="text" value={privacyLabel} onChange={(e) => setPrivacyLabel(e.target.value)}
              placeholder="Acme Privacy Policy" className={inputCls} />
          </Field>
        </Section>

        <Section title={`Completion Screens (${screens.length})`} onJump={() => setPreviewPage('completion')}>
          <div className="space-y-3">
            {screens.map((s, i) => (
              <div key={s.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-gray-500">
                    {i === 0 ? 'Default' : `Screen ${i + 1}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button type="button"
                      onClick={() => { setPreviewPage('completion'); setPreviewScreenId(s.id); }}
                      className="text-2xs text-teal hover:text-teal-hover font-medium">
                      Preview
                    </button>
                    {screens.length > 1 && (
                      <button type="button" onClick={() => removeScreen(s.id)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <input type="text" value={s.headline}
                    onChange={(e) => updateScreen(s.id, { headline: e.target.value })}
                    placeholder="Headline" className={inputCls} />
                  <textarea value={s.description}
                    onChange={(e) => updateScreen(s.id, { description: e.target.value })}
                    rows={2} placeholder="Description"
                    className={`${inputCls} resize-y min-h-[60px]`} />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={s.button_label}
                      onChange={(e) => updateScreen(s.id, { button_label: e.target.value })}
                      placeholder="Button label" className={inputCls} />
                    <input type="url" value={s.button_url}
                      onChange={(e) => updateScreen(s.id, { button_url: e.target.value })}
                      placeholder="https://example.com" className={inputCls} />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={addScreen}
              className="w-full px-3 py-2 rounded-xl text-[13px] font-medium text-teal hover:bg-teal/5 border border-dashed border-gray-300 hover:border-teal transition-colors inline-flex items-center justify-center gap-1.5">
              <Plus size={14} /> Add screen
            </button>
          </div>
        </Section>

        <Section title="Conditional Logic">
          <p className="text-[11px] text-gray-500 -mt-1">
            Send users to a different completion screen based on their answer to a multiple-choice question.
          </p>
          <ConditionalLogicEditor
            logic={logic}
            onChange={setLogic}
            multipleChoiceQuestions={multipleChoiceQuestions}
            screens={screens}
          />
        </Section>

        <FormActions
          onBack={onBack}
          onCancel={onCancel}
          disabled={!title.trim() || !introHeadline.trim() || questions.length === 0 || busy}
          uploading={busy}
          previewToggle={{ visible: showPreview, enabled: true, onToggle: togglePreview }}
        />
      </div>

      {showPreview && (
        <div className="w-1/2 p-6 overflow-y-auto bg-gray-50 flex items-start justify-center">
          <MetaLeadFormMockupPreview
            data={data}
            page={previewPage}
            onPageChange={setPreviewPage}
            completionScreenId={previewScreenId}
            onCompletionScreenChange={setPreviewScreenId}
          />
        </div>
      )}
    </form>
  );
}

/* ─── Question card ─────────────────────────────────────────────── */

type TypeOptionList =
  | QuestionTypeMeta[]
  | { groupLabel: string; items: QuestionTypeMeta[] }[];

function isGrouped(opts: TypeOptionList): opts is { groupLabel: string; items: QuestionTypeMeta[] }[] {
  return Array.isArray(opts) && opts.length > 0 && 'groupLabel' in (opts[0] as object);
}

function QuestionCard({
  question, positionLabel, typeOptions, isFirst, isLast,
  onUpdate, onMove, onRemove,
}: {
  question: MetaLeadFormQuestion;
  positionLabel: string;
  typeOptions: TypeOptionList;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (patch: Partial<MetaLeadFormQuestion>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
      <div className="flex items-center gap-1 mb-2">
        <GripVertical size={14} className="text-gray-300" />
        <span className="text-2xs font-semibold uppercase tracking-wider text-gray-400">
          {positionLabel}
        </span>
        <select
          value={question.type}
          onChange={(e) => {
            const type = e.target.value as MetaLeadFormQuestionType;
            onUpdate({
              type,
              options: type === 'multiple_choice'
                ? (question.options?.length ? question.options : ['Option 1', 'Option 2'])
                : undefined,
            });
          }}
          className="ml-2 text-xs px-2 py-1 rounded-md border border-gray-200 bg-white"
        >
          {isGrouped(typeOptions)
            ? typeOptions.map((g) => (
                <optgroup key={g.groupLabel} label={g.groupLabel}>
                  {g.items.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
              ))
            : typeOptions.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
        </select>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={() => onMove(-1)}
            className="p-1 rounded hover:bg-gray-200 text-gray-500 disabled:opacity-30" disabled={isFirst}>
            <ChevronUp size={13} />
          </button>
          <button type="button" onClick={() => onMove(1)}
            className="p-1 rounded hover:bg-gray-200 text-gray-500 disabled:opacity-30" disabled={isLast}>
            <ChevronDown size={13} />
          </button>
          <button type="button" onClick={onRemove}
            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <input type="text" value={question.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
        placeholder={`Label (default: ${labelFallback(question.type)})`}
        className={`${inputCls} mb-2`} />

      {question.type === 'multiple_choice' && (
        <div className="space-y-1.5 pl-2 border-l-2 border-gray-200">
          {(question.options || []).map((opt, oi) => (
            <div key={oi} className="flex items-center gap-1.5">
              <input type="text" value={opt}
                onChange={(e) => {
                  const next = [...(question.options || [])];
                  next[oi] = e.target.value;
                  onUpdate({ options: next });
                }}
                placeholder={`Option ${oi + 1}`}
                className="flex-1 px-2 py-1.5 bg-white rounded-md text-xs border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal/20" />
              <button type="button"
                onClick={() => {
                  const next = (question.options || []).filter((_, j) => j !== oi);
                  onUpdate({ options: next });
                }}
                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                <X size={12} />
              </button>
            </div>
          ))}
          <button type="button"
            onClick={() => onUpdate({ options: [...(question.options || []), `Option ${(question.options?.length || 0) + 1}`] })}
            className="text-[11px] text-teal hover:text-teal-hover font-medium inline-flex items-center gap-1">
            <Plus size={11} /> Add option
          </button>
        </div>
      )}

      <label className="flex items-center gap-1.5 mt-2 text-[11px] text-gray-600">
        <input type="checkbox" checked={!!question.required}
          onChange={(e) => onUpdate({ required: e.target.checked })}
          className="accent-teal" />
        Required
      </label>
    </div>
  );
}

/* ─── Conditional logic editor ──────────────────────────────────── */

function ConditionalLogicEditor({
  logic, onChange, multipleChoiceQuestions, screens,
}: {
  logic: MetaLeadFormCompletionLogic | null;
  onChange: (next: MetaLeadFormCompletionLogic | null) => void;
  multipleChoiceQuestions: MetaLeadFormQuestion[];
  screens: MetaLeadFormCompletionScreen[];
}) {
  if (multipleChoiceQuestions.length === 0) {
    return (
      <div className="text-[11px] italic text-gray-400 px-3 py-3 border border-dashed border-gray-200 rounded-lg">
        Add a multiple-choice question to enable conditional logic.
      </div>
    );
  }
  if (screens.length < 2) {
    return (
      <div className="text-[11px] italic text-gray-400 px-3 py-3 border border-dashed border-gray-200 rounded-lg">
        Add a second completion screen to enable conditional logic.
      </div>
    );
  }

  if (!logic) {
    return (
      <button
        type="button"
        onClick={() => onChange({
          question_id: multipleChoiceQuestions[0].id,
          default_screen_id: screens[0].id,
          rules: [],
        })}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium text-teal hover:bg-teal/5 border border-dashed border-gray-300 hover:border-teal transition-colors"
      >
        <Zap size={14} /> Add logic rule
      </button>
    );
  }

  const activeQ = multipleChoiceQuestions.find((q) => q.id === logic.question_id) || multipleChoiceQuestions[0];
  const options = activeQ.options || [];

  const setRule = (option: string, screen_id: string) => {
    const rules = logic.rules.filter((r) => r.option !== option);
    if (screen_id) rules.push({ option, screen_id });
    onChange({ ...logic, rules });
  };
  const ruleFor = (option: string) =>
    logic.rules.find((r) => r.option === option)?.screen_id || '';

  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-gray-500 shrink-0">When answer to</span>
        <select
          value={logic.question_id}
          onChange={(e) => onChange({ ...logic, question_id: e.target.value, rules: [] })}
          className="flex-1 text-xs px-2 py-1 rounded-md border border-gray-200 bg-white"
        >
          {multipleChoiceQuestions.map((q) => (
            <option key={q.id} value={q.id}>
              {q.label?.trim() || 'Untitled question'}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        {options.length === 0 && (
          <p className="text-[11px] italic text-gray-400">Add options to that question first.</p>
        )}
        {options.map((opt) => (
          <div key={opt} className="flex items-center gap-2">
            <span className="text-[11px] text-gray-600 truncate flex-1 max-w-[120px]" title={opt}>
              is "{opt}"
            </span>
            <span className="text-[11px] text-gray-400">→</span>
            <select
              value={ruleFor(opt)}
              onChange={(e) => setRule(opt, e.target.value)}
              className="flex-1 text-xs px-2 py-1 rounded-md border border-gray-200 bg-white"
            >
              <option value="">Use default</option>
              {screens.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {s.headline?.trim() || `Screen ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
        <span className="text-[11px] font-medium text-gray-500 shrink-0">Otherwise</span>
        <select
          value={logic.default_screen_id}
          onChange={(e) => onChange({ ...logic, default_screen_id: e.target.value })}
          className="flex-1 text-xs px-2 py-1 rounded-md border border-gray-200 bg-white"
        >
          {screens.map((s, i) => (
            <option key={s.id} value={s.id}>
              {s.headline?.trim() || `Screen ${i + 1}`}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => onChange(null)}
        className="text-[11px] text-gray-400 hover:text-red-500 transition-colors"
      >
        Remove logic
      </button>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────── */

const inputCls =
  'w-full px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function Section({
  title, onJump, children,
}: { title: string; onJump?: () => void; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-700">{title}</h4>
        {onJump && (
          <button type="button" onClick={onJump}
            className="text-2xs font-medium text-teal hover:text-teal-hover">
            Jump to preview →
          </button>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function labelFallback(type: MetaLeadFormQuestionType): string {
  switch (type) {
    case 'email': return 'Email';
    case 'phone': return 'Phone number';
    case 'full_name': return 'Full name';
    case 'first_name': return 'First name';
    case 'last_name': return 'Last name';
    case 'street_address': return 'Street address';
    case 'city': return 'City';
    case 'state': return 'State';
    case 'province': return 'Province';
    case 'country': return 'Country';
    case 'post_code': return 'Post code';
    case 'date_of_birth': return 'Date of birth';
    case 'gender': return 'Gender';
    case 'company_name': return 'Company name';
    case 'job_title': return 'Job title';
    case 'work_email': return 'Work email';
    case 'work_phone': return 'Work phone number';
    case 'short_answer': return 'Short answer';
    case 'multiple_choice': return 'Choose one';
  }
}
