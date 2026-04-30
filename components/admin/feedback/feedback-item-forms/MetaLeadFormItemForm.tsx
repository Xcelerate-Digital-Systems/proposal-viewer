'use client';

import { useState, useRef, useMemo } from 'react';
import { X, Upload, Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import MetaLeadFormMockupPreview, {
  type MetaLeadFormPage,
} from '@/components/admin/feedback/MetaLeadFormMockupPreview';
import type {
  MetaLeadFormData,
  MetaLeadFormQuestion,
  MetaLeadFormQuestionType,
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

const QUESTION_TYPES: { value: MetaLeadFormQuestionType; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone number' },
  { value: 'full_name', label: 'Full name' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'city', label: 'City' },
  { value: 'short_answer', label: 'Short answer' },
  { value: 'multiple_choice', label: 'Multiple choice' },
];

function newQuestion(type: MetaLeadFormQuestionType = 'short_answer'): MetaLeadFormQuestion {
  return {
    id: crypto.randomUUID(),
    type,
    label: '',
    options: type === 'multiple_choice' ? ['Option 1', 'Option 2'] : undefined,
    required: true,
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
  const [completionHeadline, setCompletionHeadline] = useState('Thanks, you’re all set.');
  const [completionDescription, setCompletionDescription] = useState(
    'You can close this form now or visit our website to learn more.'
  );
  const [completionButton, setCompletionButton] = useState('View Website');
  const [completionUrl, setCompletionUrl] = useState('');

  const [showPreview, setShowPreview] = useState(false);
  const [previewPage, setPreviewPage] = useState<MetaLeadFormPage>('intro');
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
      completion_headline: completionHeadline,
      completion_description: completionDescription,
      completion_button_label: completionButton,
      completion_url: completionUrl,
    }),
    [
      coverPreview, introHeadline, introDescription, businessName, cta,
      questions, privacyUrl, privacyLabel,
      completionHeadline, completionDescription, completionButton, completionUrl,
    ]
  );

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
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
  };

  const moveQuestion = (id: string, dir: -1 | 1) => {
    setQuestions((qs) => {
      const idx = qs.findIndex((q) => q.id === id);
      if (idx === -1) return qs;
      const next = idx + dir;
      if (next < 0 || next >= qs.length) return qs;
      const copy = [...qs];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  };

  const addQuestion = () => {
    setQuestions((qs) => [...qs, newQuestion()]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!introHeadline.trim()) {
      toast.error('Intro headline is required');
      return;
    }
    if (questions.length === 0) {
      toast.error('Add at least one question');
      return;
    }

    setSubmitting(true);
    let coverUrl: string | null = null;
    if (coverFile) {
      coverUrl = await onUploadAsset(coverFile);
      if (!coverUrl) {
        setSubmitting(false);
        return;
      }
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
        completion_headline: completionHeadline.trim(),
        completion_description: completionDescription.trim(),
        completion_button_label: completionButton.trim(),
        completion_url: completionUrl.trim(),
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
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New Plumbing Lead Form"
              className={inputCls}
              autoFocus
            />
          </Field>
          <Field label="Business Name">
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Shown on the form (e.g. Acme Plumbing)"
              className={inputCls}
            />
          </Field>
        </Section>

        <Section title="Intro Page" onJump={() => setPreviewPage('intro')}>
          <Field label="Cover Image">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
            {coverPreview ? (
              <div className="relative">
                <img src={coverPreview} alt="Cover" className="w-full max-h-[160px] object-cover rounded-lg border border-gray-200 bg-gray-50" />
                <button
                  type="button"
                  onClick={clearCover}
                  className="absolute top-2 right-2 p-1 bg-white/90 rounded-full border border-gray-200 text-gray-500 hover:text-red-500"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-teal hover:bg-teal/5 transition-colors"
              >
                <Upload size={20} className="mx-auto mb-1.5 text-gray-400" />
                <p className="text-xs font-medium text-gray-600">Upload cover image</p>
                <p className="text-[10px] text-gray-400 mt-0.5">1.91:1 ratio recommended</p>
              </button>
            )}
          </Field>
          <Field label="Headline *">
            <input
              type="text"
              value={introHeadline}
              onChange={(e) => setIntroHeadline(e.target.value)}
              placeholder="Get a Free Quote"
              className={inputCls}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={introDescription}
              onChange={(e) => setIntroDescription(e.target.value)}
              rows={3}
              placeholder="Short pitch describing the offer or what the user gets…"
              className={`${inputCls} resize-y min-h-[72px]`}
            />
          </Field>
          <Field label="CTA Button Text">
            <input
              type="text"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="Continue"
              className={inputCls}
            />
          </Field>
        </Section>

        <Section title={`Questions (${questions.length})`} onJump={() => setPreviewPage('questions')}>
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={q.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                <div className="flex items-center gap-1 mb-2">
                  <GripVertical size={14} className="text-gray-300" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Q{i + 1}
                  </span>
                  <select
                    value={q.type}
                    onChange={(e) => {
                      const type = e.target.value as MetaLeadFormQuestionType;
                      updateQuestion(q.id, {
                        type,
                        options: type === 'multiple_choice'
                          ? (q.options?.length ? q.options : ['Option 1', 'Option 2'])
                          : undefined,
                      });
                    }}
                    className="ml-2 text-[12px] px-2 py-1 rounded-md border border-gray-200 bg-white"
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <div className="ml-auto flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveQuestion(q.id, -1)}
                      className="p-1 rounded hover:bg-gray-200 text-gray-500 disabled:opacity-30"
                      disabled={i === 0}
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveQuestion(q.id, 1)}
                      className="p-1 rounded hover:bg-gray-200 text-gray-500 disabled:opacity-30"
                      disabled={i === questions.length - 1}
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQuestion(q.id)}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={q.label}
                  onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                  placeholder={`Question label (default: ${labelFallback(q.type)})`}
                  className={`${inputCls} mb-2`}
                />

                {q.type === 'multiple_choice' && (
                  <div className="space-y-1.5 pl-2 border-l-2 border-gray-200">
                    {(q.options || []).map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const next = [...(q.options || [])];
                            next[oi] = e.target.value;
                            updateQuestion(q.id, { options: next });
                          }}
                          placeholder={`Option ${oi + 1}`}
                          className="flex-1 px-2 py-1.5 bg-white rounded-md text-[12px] border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal/20"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = (q.options || []).filter((_, j) => j !== oi);
                            updateQuestion(q.id, { options: next });
                          }}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => updateQuestion(q.id, { options: [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`] })}
                      className="text-[11px] text-teal hover:text-teal-hover font-medium inline-flex items-center gap-1"
                    >
                      <Plus size={11} /> Add option
                    </button>
                  </div>
                )}

                <label className="flex items-center gap-1.5 mt-2 text-[11px] text-gray-600">
                  <input
                    type="checkbox"
                    checked={!!q.required}
                    onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
                    className="accent-teal"
                  />
                  Required
                </label>
              </div>
            ))}

            <button
              type="button"
              onClick={addQuestion}
              className="w-full px-3 py-2 rounded-xl text-[13px] font-medium text-teal hover:bg-teal/5 border border-dashed border-gray-300 hover:border-teal transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Plus size={14} /> Add question
            </button>
          </div>
        </Section>

        <Section title="Privacy" onJump={() => setPreviewPage('privacy')}>
          <Field label="Privacy Policy URL">
            <input
              type="url"
              value={privacyUrl}
              onChange={(e) => setPrivacyUrl(e.target.value)}
              placeholder="https://example.com/privacy"
              className={inputCls}
            />
          </Field>
          <Field label="Privacy Link Label">
            <input
              type="text"
              value={privacyLabel}
              onChange={(e) => setPrivacyLabel(e.target.value)}
              placeholder="Acme Privacy Policy"
              className={inputCls}
            />
          </Field>
        </Section>

        <Section title="Completion Page" onJump={() => setPreviewPage('completion')}>
          <Field label="Headline">
            <input
              type="text"
              value={completionHeadline}
              onChange={(e) => setCompletionHeadline(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={completionDescription}
              onChange={(e) => setCompletionDescription(e.target.value)}
              rows={2}
              className={`${inputCls} resize-y min-h-[60px]`}
            />
          </Field>
          <Field label="Button Label">
            <input
              type="text"
              value={completionButton}
              onChange={(e) => setCompletionButton(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Button URL">
            <input
              type="url"
              value={completionUrl}
              onChange={(e) => setCompletionUrl(e.target.value)}
              placeholder="https://example.com"
              className={inputCls}
            />
          </Field>
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
          />
        </div>
      )}
    </form>
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
          <button
            type="button"
            onClick={onJump}
            className="text-[10px] font-medium text-teal hover:text-teal-hover"
          >
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
    case 'city': return 'City';
    case 'short_answer': return 'Short answer';
    case 'multiple_choice': return 'Choose one';
  }
}
