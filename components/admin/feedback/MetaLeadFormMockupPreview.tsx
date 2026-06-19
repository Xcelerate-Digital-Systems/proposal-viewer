'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft, MoreHorizontal, Lock, Check, ExternalLink,
  Image as ImageIcon, Pencil, ChevronDown,
} from 'lucide-react';
import {
  type MetaLeadFormData,
  type MetaLeadFormQuestion,
  type MetaLeadFormQuestionType,
  type MetaLeadFormCompletionScreen,
  isMetaLeadFormPrefillType,
  getCompletionScreens,
} from '@/lib/types/feedback';

export type MetaLeadFormPage =
  | 'intro'
  | 'custom_questions'
  | 'contact_info'
  | 'privacy'
  | 'review'
  | 'completion';

interface MetaLeadFormMockupPreviewProps {
  data: MetaLeadFormData;
  /** Controlled active page. When omitted, internal state is used. */
  page?: MetaLeadFormPage;
  onPageChange?: (page: MetaLeadFormPage) => void;
  /** Show the page navigator pill row. Defaults to true. */
  showPageNav?: boolean;
  accentColor?: string;
  /** Render in dark mode for the public viewer. */
  dark?: boolean;
  /** When the form has multiple completion screens, controls which one renders.
   *  When omitted the user picks via the in-mockup dropdown. */
  completionScreenId?: string;
  onCompletionScreenChange?: (id: string) => void;
}

const ALL_PAGES: { key: MetaLeadFormPage; label: string }[] = [
  { key: 'intro',            label: 'Intro' },
  { key: 'custom_questions', label: 'Questions' },
  { key: 'contact_info',     label: 'Contact' },
  { key: 'privacy',          label: 'Privacy' },
  { key: 'review',           label: 'Review' },
  { key: 'completion',       label: 'Done' },
];

export default function MetaLeadFormMockupPreview({
  data,
  page,
  onPageChange,
  showPageNav = true,
  accentColor,
  dark = false,
  completionScreenId,
  onCompletionScreenChange,
}: MetaLeadFormMockupPreviewProps) {
  const customQuestions = useMemo(
    () => data.questions.filter((q) => !isMetaLeadFormPrefillType(q.type)),
    [data.questions],
  );
  const prefillQuestions = useMemo(
    () => data.questions.filter((q) => isMetaLeadFormPrefillType(q.type)),
    [data.questions],
  );

  // Hide pages that have no content (no custom questions / no contact fields).
  const visiblePages = useMemo<MetaLeadFormPage[]>(() => {
    const out: MetaLeadFormPage[] = ['intro'];
    if (customQuestions.length > 0) out.push('custom_questions');
    if (prefillQuestions.length > 0) out.push('contact_info');
    out.push('privacy', 'review', 'completion');
    return out;
  }, [customQuestions.length, prefillQuestions.length]);

  const [internalPage, setInternalPage] = useState<MetaLeadFormPage>('intro');
  const activePage = page ?? internalPage;
  const safePage: MetaLeadFormPage = visiblePages.includes(activePage) ? activePage : 'intro';

  useEffect(() => {
    if (page) setInternalPage(page);
  }, [page]);

  const setPage = (next: MetaLeadFormPage) => {
    if (!page) setInternalPage(next);
    onPageChange?.(next);
  };

  // Walk the visible pages in order so Continue/Next buttons advance correctly.
  const goNext = () => {
    const i = visiblePages.indexOf(safePage);
    const next = visiblePages[i + 1];
    if (next) setPage(next);
  };

  const fbBlue = accentColor || '#1877F2';
  const businessName = data.business_name?.trim() || 'Your Business';

  // Completion-screen state — internal when uncontrolled.
  const screens = useMemo(() => getCompletionScreens(data), [data]);
  const [internalScreenId, setInternalScreenId] = useState<string>(screens[0].id);
  const activeScreenId =
    completionScreenId && screens.some((s) => s.id === completionScreenId)
      ? completionScreenId
      : (screens.some((s) => s.id === internalScreenId) ? internalScreenId : screens[0].id);
  const activeScreen = screens.find((s) => s.id === activeScreenId) || screens[0];

  const setScreen = (id: string) => {
    if (!completionScreenId) setInternalScreenId(id);
    onCompletionScreenChange?.(id);
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div
        className="relative shrink-0"
        style={{
          width: 320,
          height: 640,
          borderRadius: 38,
          padding: 10,
          background: '#0a0a0a',
          boxShadow: '0 24px 48px rgba(0,0,0,0.18), inset 0 0 0 2px #2a2a2a',
        }}
      >
        <div
          className="relative w-full h-full overflow-hidden flex flex-col"
          style={{
            borderRadius: 28,
            backgroundColor: dark ? '#000000' : '#ffffff',
            color: dark ? '#f5f5f5' : '#050505',
          }}
        >
          <div className="flex items-center justify-between px-5 pt-2 pb-1 text-detail font-semibold"
            style={{ color: dark ? '#f5f5f5' : '#050505' }}>
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span>•••</span>
              <span>5G</span>
              <span>100%</span>
            </span>
          </div>

          <div className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: dark ? '#222' : '#e4e6e9' }}>
            <button className="p-1" style={{ color: dark ? '#f5f5f5' : '#050505' }}>
              <ChevronLeft size={20} />
            </button>
            <span className="text-caption font-semibold truncate max-w-[180px]">
              {safePage === 'completion' ? 'Thanks!' : safePage === 'review' ? 'Review' : 'Form'}
            </span>
            <button className="p-1" style={{ color: dark ? '#f5f5f5' : '#050505' }}>
              <MoreHorizontal size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {safePage === 'intro' && (
              <IntroPage data={data} fbBlue={fbBlue} onContinue={goNext} dark={dark} />
            )}
            {safePage === 'custom_questions' && (
              <QuestionsPage
                title="A few quick questions"
                subtitle={`${businessName} would like you to answer the following.`}
                questions={customQuestions}
                fbBlue={fbBlue}
                onNext={goNext}
                dark={dark}
                buttonLabel="Next"
              />
            )}
            {safePage === 'contact_info' && (
              <QuestionsPage
                title="Your contact info"
                subtitle="We've filled this in for you. Edit if needed."
                questions={prefillQuestions}
                fbBlue={fbBlue}
                onNext={goNext}
                dark={dark}
                buttonLabel="Next"
                prefilled
              />
            )}
            {safePage === 'privacy' && (
              <PrivacyPage
                data={data}
                fbBlue={fbBlue}
                onSubmit={goNext}
                businessName={businessName}
                dark={dark}
              />
            )}
            {safePage === 'review' && (
              <ReviewPage
                customQuestions={customQuestions}
                prefillQuestions={prefillQuestions}
                fbBlue={fbBlue}
                onSubmit={goNext}
                dark={dark}
              />
            )}
            {safePage === 'completion' && (
              <CompletionPage
                screen={activeScreen}
                screens={screens}
                fbBlue={fbBlue}
                dark={dark}
                hasLogic={!!data.completion_logic && (data.completion_logic.rules.length > 0)}
                onPickScreen={setScreen}
              />
            )}
          </div>
        </div>

        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-2xl pointer-events-none"
          style={{ width: 110, height: 22, background: '#0a0a0a' }}
        />
      </div>

      {showPageNav && (
        <div className="flex items-center gap-1 rounded-full p-1 border"
          style={{
            borderColor: dark ? '#ffffff18' : '#e5e7eb',
            backgroundColor: dark ? '#ffffff08' : '#f9fafb',
          }}>
          {ALL_PAGES.filter((p) => visiblePages.includes(p.key)).map((p) => {
            const active = safePage === p.key;
            return (
              <button
                key={p.key}
                onClick={(e) => { e.stopPropagation(); setPage(p.key); }}
                className="px-3 py-1 text-detail font-medium rounded-full transition-colors"
                style={{
                  backgroundColor: active ? fbBlue : 'transparent',
                  color: active ? '#ffffff' : (dark ? '#ffffff88' : '#6b7280'),
                }}
                type="button"
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Intro                                                              */
/* ================================================================== */

function IntroPage({
  data, fbBlue, onContinue, dark,
}: { data: MetaLeadFormData; fbBlue: string; onContinue: () => void; dark: boolean }) {
  const subtle = dark ? '#a8a8a8' : '#65676b';
  return (
    <div className="flex flex-col">
      <div
        className="w-full overflow-hidden flex items-center justify-center"
        style={{
          aspectRatio: '1.91 / 1',
          backgroundColor: dark ? '#1a1a1a' : '#f0f2f5',
        }}
      >
        {data.cover_url ? (
          <img src={data.cover_url} alt="Cover" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center text-center px-4" style={{ color: subtle }}>
            <ImageIcon size={28} />
            <p className="text-detail mt-1">Cover image</p>
          </div>
        )}
      </div>

      <div className="px-4 py-4 flex flex-col gap-2">
        <h2 className="text-lg font-bold leading-tight">
          {data.intro_headline?.trim() || 'Headline goes here'}
        </h2>
        <p className="text-caption leading-snug whitespace-pre-wrap" style={{ color: subtle }}>
          {data.intro_description?.trim() || 'A short pitch describing what the user gets when they fill out this form.'}
        </p>
      </div>

      <div className="mt-auto px-4 pb-4 pt-2">
        <button
          onClick={(e) => { e.stopPropagation(); onContinue(); }}
          className="w-full py-3 rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: fbBlue }}
          type="button"
        >
          {data.cta?.trim() || 'Continue'}
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Questions (used for Custom and Contact pages)                      */
/* ================================================================== */

function QuestionsPage({
  title, subtitle, questions, fbBlue, onNext, buttonLabel, dark, prefilled,
}: {
  title: string;
  subtitle: string;
  questions: MetaLeadFormQuestion[];
  fbBlue: string;
  onNext: () => void;
  buttonLabel: string;
  dark: boolean;
  prefilled?: boolean;
}) {
  const subtle = dark ? '#a8a8a8' : '#65676b';
  const fieldBg = dark ? '#1a1a1a' : '#f0f2f5';
  const border = dark ? '#2a2a2a' : '#dadde1';

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-base font-bold leading-tight">{title}</h2>
        <p className="text-xs leading-snug mt-1" style={{ color: subtle }}>{subtitle}</p>
      </div>

      <div className="px-4 py-2 flex flex-col gap-3">
        {questions.length === 0 && (
          <div className="text-xs italic py-6 text-center" style={{ color: subtle }}>
            No questions on this page yet.
          </div>
        )}
        {questions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            fieldBg={fieldBg}
            border={border}
            subtle={subtle}
            dark={dark}
            prefilled={prefilled}
          />
        ))}
      </div>

      <div className="mt-auto px-4 pb-4 pt-2">
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="w-full py-3 rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: fbBlue }}
          type="button"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

const PREFILL_SAMPLES: Partial<Record<MetaLeadFormQuestionType, string>> = {
  email: 'jamie@example.com',
  phone: '+1 (555) 010-2233',
  full_name: 'Jamie Carter',
  first_name: 'Jamie',
  last_name: 'Carter',
  street_address: '123 Main St',
  city: 'Sydney',
  state: 'NSW',
  province: 'NSW',
  country: 'Australia',
  post_code: '2000',
  date_of_birth: '12 / 04 / 1992',
  gender: 'Female',
  company_name: 'Acme Inc.',
  job_title: 'Marketing Manager',
  work_email: 'jamie@acme.com',
  work_phone: '+1 (555) 010-7788',
};

function QuestionField({
  question, fieldBg, border, subtle, dark, prefilled,
}: {
  question: MetaLeadFormQuestion;
  fieldBg: string;
  border: string;
  subtle: string;
  dark: boolean;
  prefilled?: boolean;
}) {
  const placeholderByType: Partial<Record<MetaLeadFormQuestionType, string>> = {
    short_answer: 'Type your answer',
    email: 'name@example.com',
    phone: '+1 555 000 0000',
    full_name: 'Your full name',
    first_name: 'First name',
    last_name: 'Last name',
    street_address: 'Street address',
    city: 'City',
    state: 'State',
    province: 'Province',
    country: 'Country',
    post_code: 'Post code',
    date_of_birth: 'DD / MM / YYYY',
    gender: 'Gender',
    company_name: 'Company name',
    job_title: 'Job title',
    work_email: 'name@company.com',
    work_phone: '+1 555 000 0000',
  };

  const label = question.label?.trim() || labelForType(question.type);
  const sampleValue = prefilled ? PREFILL_SAMPLES[question.type] : null;
  const placeholder = placeholderByType[question.type] || 'Type your answer';

  if (question.type === 'multiple_choice') {
    const options = question.options?.length ? question.options : ['Option 1', 'Option 2'];
    return (
      <div>
        <label className="text-xs font-semibold block mb-1.5">
          {label}{question.required && <span style={{ color: '#ef4444' }}> *</span>}
        </label>
        <div className="flex flex-col gap-1.5">
          {options.map((opt, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ backgroundColor: fieldBg, border: `1px solid ${border}`, color: dark ? '#f5f5f5' : '#050505' }}
            >
              <span
                className="w-3.5 h-3.5 rounded-full border shrink-0"
                style={{ borderColor: subtle }}
              />
              <span className="truncate">{opt}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs font-semibold block mb-1.5">
        {label}{question.required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      <div
        className="px-3 py-2.5 rounded-lg text-xs"
        style={{
          backgroundColor: fieldBg,
          border: `1px solid ${border}`,
          color: sampleValue ? (dark ? '#f5f5f5' : '#050505') : subtle,
        }}
      >
        {sampleValue ?? placeholder}
      </div>
    </div>
  );
}

function labelForType(type: MetaLeadFormQuestionType): string {
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

/* ================================================================== */
/*  Privacy                                                            */
/* ================================================================== */

function PrivacyPage({
  data, fbBlue, onSubmit, businessName, dark,
}: { data: MetaLeadFormData; fbBlue: string; onSubmit: () => void; businessName: string; dark: boolean }) {
  const subtle = dark ? '#a8a8a8' : '#65676b';
  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <Lock size={14} style={{ color: subtle }} />
          <span className="text-xs font-semibold">Privacy</span>
        </div>
        <p className="text-xs leading-snug" style={{ color: subtle }}>
          By clicking Continue, you agree to send your info to {businessName} who agrees to use it according to their privacy policy. Meta will also use it subject to the Meta Privacy Policy, including to autofill forms for ads.
        </p>

        <a
          href={data.privacy_policy_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium border"
          style={{ borderColor: dark ? '#2a2a2a' : '#dadde1' }}
        >
          <span className="truncate">
            {data.privacy_policy_label?.trim() || `${businessName} Privacy Policy`}
          </span>
          <ExternalLink size={14} style={{ color: subtle }} />
        </a>

        <a
          href="https://www.facebook.com/privacy/policy"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-2 flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium border"
          style={{ borderColor: dark ? '#2a2a2a' : '#dadde1' }}
        >
          <span>View Meta Privacy Policy</span>
          <ExternalLink size={14} style={{ color: subtle }} />
        </a>
      </div>

      <div className="mt-auto px-4 pb-4 pt-2">
        <button
          onClick={(e) => { e.stopPropagation(); onSubmit(); }}
          className="w-full py-3 rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: fbBlue }}
          type="button"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Review                                                             */
/* ================================================================== */

function ReviewPage({
  customQuestions, prefillQuestions, fbBlue, onSubmit, dark,
}: {
  customQuestions: MetaLeadFormQuestion[];
  prefillQuestions: MetaLeadFormQuestion[];
  fbBlue: string;
  onSubmit: () => void;
  dark: boolean;
}) {
  const subtle = dark ? '#a8a8a8' : '#65676b';
  const border = dark ? '#222' : '#e4e6e9';

  const sample = (q: MetaLeadFormQuestion): string => {
    if (q.type === 'multiple_choice') {
      const opts = q.options?.length ? q.options : ['Option 1'];
      return opts[0];
    }
    return PREFILL_SAMPLES[q.type] ?? 'Sample answer';
  };

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-base font-bold leading-tight">Review your info</h2>
        <p className="text-xs leading-snug mt-1" style={{ color: subtle }}>
          Tap to edit anything that's not quite right.
        </p>
      </div>

      <div className="px-4 py-2 flex flex-col gap-2">
        {[...customQuestions, ...prefillQuestions].length === 0 && (
          <div className="text-xs italic py-6 text-center" style={{ color: subtle }}>
            Nothing to review.
          </div>
        )}
        {[...customQuestions, ...prefillQuestions].map((q) => (
          <div
            key={q.id}
            className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg border"
            style={{ borderColor: border }}
          >
            <div className="min-w-0 flex-1">
              <div className="text-2xs uppercase tracking-wider font-semibold" style={{ color: subtle }}>
                {q.label?.trim() || labelForType(q.type)}
              </div>
              <div className="text-xs mt-0.5 truncate">{sample(q)}</div>
            </div>
            <Pencil size={12} className="mt-0.5 shrink-0" style={{ color: subtle }} />
          </div>
        ))}
      </div>

      <div className="mt-auto px-4 pb-4 pt-2">
        <button
          onClick={(e) => { e.stopPropagation(); onSubmit(); }}
          className="w-full py-3 rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: fbBlue }}
          type="button"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Completion                                                         */
/* ================================================================== */

function CompletionPage({
  screen, screens, fbBlue, dark, hasLogic, onPickScreen,
}: {
  screen: MetaLeadFormCompletionScreen;
  screens: MetaLeadFormCompletionScreen[];
  fbBlue: string;
  dark: boolean;
  hasLogic: boolean;
  onPickScreen: (id: string) => void;
}) {
  const subtle = dark ? '#a8a8a8' : '#65676b';
  const showPicker = screens.length > 1;

  return (
    <div className="flex flex-col h-full">
      {showPicker && (
        <div
          className="px-3 py-2 flex items-center gap-2 text-2xs border-b"
          style={{
            borderColor: dark ? '#222' : '#e4e6e9',
            color: subtle,
            backgroundColor: dark ? '#0e0e0e' : '#f9fafb',
          }}
        >
          <span className="font-semibold uppercase tracking-wider shrink-0">
            {hasLogic ? 'Logic preview' : 'Preview screen'}
          </span>
          <div className="relative flex-1">
            <select
              value={screen.id}
              onChange={(e) => onPickScreen(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full appearance-none pl-2 pr-6 py-1 rounded-lg text-detail border focus:outline-none"
              style={{
                borderColor: dark ? '#2a2a2a' : '#dadde1',
                backgroundColor: dark ? '#000' : '#fff',
                color: dark ? '#f5f5f5' : '#050505',
              }}
            >
              {screens.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {s.headline?.trim() || `Screen ${i + 1}`}
                </option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}

      <div className="px-4 pt-8 pb-4 flex flex-col items-center text-center gap-3">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ backgroundColor: fbBlue }}
        >
          <Check size={28} className="text-white" strokeWidth={3} />
        </div>
        <h2 className="text-lg font-bold leading-tight">
          {screen.headline?.trim() || 'Thanks, you’re all set.'}
        </h2>
        <p className="text-caption leading-snug whitespace-pre-wrap" style={{ color: subtle }}>
          {screen.description?.trim() || 'You can close this form now.'}
        </p>
      </div>

      <div className="mt-auto px-4 pb-4 pt-2">
        <button
          className="w-full py-3 rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: fbBlue }}
          type="button"
        >
          {screen.button_label?.trim() || 'View Website'}
        </button>
      </div>
    </div>
  );
}
