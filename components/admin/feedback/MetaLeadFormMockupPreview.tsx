'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, MoreHorizontal, Lock, Check, ExternalLink, Image as ImageIcon } from 'lucide-react';
import type { MetaLeadFormData, MetaLeadFormQuestion } from '@/lib/types/feedback';

export type MetaLeadFormPage = 'intro' | 'questions' | 'privacy' | 'completion';

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
}

const PAGES: { key: MetaLeadFormPage; label: string }[] = [
  { key: 'intro', label: 'Intro' },
  { key: 'questions', label: 'Questions' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'completion', label: 'Done' },
];

export default function MetaLeadFormMockupPreview({
  data,
  page,
  onPageChange,
  showPageNav = true,
  accentColor,
  dark = false,
}: MetaLeadFormMockupPreviewProps) {
  const [internalPage, setInternalPage] = useState<MetaLeadFormPage>('intro');
  const activePage = page ?? internalPage;

  // Keep internal state in sync if parent stops controlling.
  useEffect(() => {
    if (page) setInternalPage(page);
  }, [page]);

  const setPage = (next: MetaLeadFormPage) => {
    if (!page) setInternalPage(next);
    onPageChange?.(next);
  };

  const fbBlue = accentColor || '#1877F2';
  const businessName = data.business_name?.trim() || 'Your Business';

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Phone frame */}
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
        {/* Screen */}
        <div
          className="relative w-full h-full overflow-hidden flex flex-col"
          style={{
            borderRadius: 28,
            backgroundColor: dark ? '#000000' : '#ffffff',
            color: dark ? '#f5f5f5' : '#050505',
          }}
        >
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-2 pb-1 text-[11px] font-semibold"
            style={{ color: dark ? '#f5f5f5' : '#050505' }}>
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span>•••</span>
              <span>5G</span>
              <span>100%</span>
            </span>
          </div>

          {/* Top app bar */}
          <div className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: dark ? '#222' : '#e4e6e9' }}>
            <button className="p-1" style={{ color: dark ? '#f5f5f5' : '#050505' }}>
              <ChevronLeft size={20} />
            </button>
            <span className="text-[13px] font-semibold truncate max-w-[180px]">
              {activePage === 'completion' ? 'Thanks!' : 'Form'}
            </span>
            <button className="p-1" style={{ color: dark ? '#f5f5f5' : '#050505' }}>
              <MoreHorizontal size={20} />
            </button>
          </div>

          {/* Page body — scrollable */}
          <div className="flex-1 overflow-y-auto">
            {activePage === 'intro' && (
              <IntroPage
                data={data}
                fbBlue={fbBlue}
                onContinue={() => setPage('questions')}
                dark={dark}
              />
            )}
            {activePage === 'questions' && (
              <QuestionsPage
                data={data}
                fbBlue={fbBlue}
                onNext={() => setPage('privacy')}
                businessName={businessName}
                dark={dark}
              />
            )}
            {activePage === 'privacy' && (
              <PrivacyPage
                data={data}
                fbBlue={fbBlue}
                onSubmit={() => setPage('completion')}
                businessName={businessName}
                dark={dark}
              />
            )}
            {activePage === 'completion' && (
              <CompletionPage data={data} fbBlue={fbBlue} dark={dark} />
            )}
          </div>
        </div>

        {/* Notch */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-2xl pointer-events-none"
          style={{ width: 110, height: 22, background: '#0a0a0a' }}
        />
      </div>

      {/* Page navigator */}
      {showPageNav && (
        <div className="flex items-center gap-1 rounded-full p-1 border"
          style={{
            borderColor: dark ? '#ffffff18' : '#e5e7eb',
            backgroundColor: dark ? '#ffffff08' : '#f9fafb',
          }}>
          {PAGES.map((p) => {
            const active = activePage === p.key;
            return (
              <button
                key={p.key}
                onClick={(e) => { e.stopPropagation(); setPage(p.key); }}
                className="px-3 py-1 text-[11px] font-medium rounded-full transition-colors"
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
      {/* Cover image */}
      <div
        className="w-full overflow-hidden flex items-center justify-center"
        style={{
          aspectRatio: '1.91 / 1',
          backgroundColor: dark ? '#1a1a1a' : '#f0f2f5',
        }}
      >
        {data.cover_url ? (
          <img src={data.cover_url} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center text-center px-4" style={{ color: subtle }}>
            <ImageIcon size={28} />
            <p className="text-[11px] mt-1">Cover image</p>
          </div>
        )}
      </div>

      <div className="px-4 py-4 flex flex-col gap-2">
        <h2 className="text-[18px] font-bold leading-tight">
          {data.intro_headline?.trim() || 'Headline goes here'}
        </h2>
        <p className="text-[13px] leading-snug whitespace-pre-wrap" style={{ color: subtle }}>
          {data.intro_description?.trim() || 'A short pitch describing what the user gets when they fill out this form.'}
        </p>
      </div>

      <div className="mt-auto px-4 pb-4 pt-2">
        <button
          onClick={(e) => { e.stopPropagation(); onContinue(); }}
          className="w-full py-3 rounded-full text-[14px] font-semibold text-white"
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
/*  Questions                                                          */
/* ================================================================== */

function QuestionsPage({
  data, fbBlue, onNext, businessName, dark,
}: { data: MetaLeadFormData; fbBlue: string; onNext: () => void; businessName: string; dark: boolean }) {
  const subtle = dark ? '#a8a8a8' : '#65676b';
  const fieldBg = dark ? '#1a1a1a' : '#f0f2f5';
  const border = dark ? '#2a2a2a' : '#dadde1';
  const questions = data.questions || [];

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-[16px] font-bold leading-tight">Your contact info</h2>
        <p className="text-[12px] leading-snug mt-1" style={{ color: subtle }}>
          {businessName} would like you to fill out the following.
        </p>
      </div>

      <div className="px-4 py-2 flex flex-col gap-3">
        {questions.length === 0 && (
          <div className="text-[12px] italic py-6 text-center" style={{ color: subtle }}>
            No questions added yet.
          </div>
        )}
        {questions.map((q) => (
          <QuestionField key={q.id} question={q} fieldBg={fieldBg} border={border} subtle={subtle} dark={dark} />
        ))}
      </div>

      <div className="mt-auto px-4 pb-4 pt-2">
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="w-full py-3 rounded-full text-[14px] font-semibold text-white"
          style={{ backgroundColor: fbBlue }}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function QuestionField({
  question, fieldBg, border, subtle, dark,
}: {
  question: MetaLeadFormQuestion;
  fieldBg: string;
  border: string;
  subtle: string;
  dark: boolean;
}) {
  const placeholderByType: Record<string, string> = {
    short_answer: 'Type your answer',
    email: 'name@example.com',
    phone: '+1 555 000 0000',
    full_name: 'Your full name',
    first_name: 'First name',
    last_name: 'Last name',
    city: 'City',
  };

  const label = question.label?.trim() || labelForType(question.type);
  const placeholder = placeholderByType[question.type] || 'Type your answer';

  if (question.type === 'multiple_choice') {
    const options = question.options?.length ? question.options : ['Option 1', 'Option 2'];
    return (
      <div>
        <label className="text-[12px] font-semibold block mb-1.5">
          {label}{question.required && <span style={{ color: '#ef4444' }}> *</span>}
        </label>
        <div className="flex flex-col gap-1.5">
          {options.map((opt, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-[12px]"
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
      <label className="text-[12px] font-semibold block mb-1.5">
        {label}{question.required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      <div
        className="px-3 py-2.5 rounded-md text-[12px]"
        style={{ backgroundColor: fieldBg, border: `1px solid ${border}`, color: subtle }}
      >
        {placeholder}
      </div>
    </div>
  );
}

function labelForType(type: MetaLeadFormQuestion['type']): string {
  switch (type) {
    case 'email': return 'Email';
    case 'phone': return 'Phone number';
    case 'full_name': return 'Full name';
    case 'first_name': return 'First name';
    case 'last_name': return 'Last name';
    case 'city': return 'City';
    case 'short_answer': return 'Short answer';
    case 'multiple_choice': return 'Choose one';
    default: return 'Question';
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
          <span className="text-[12px] font-semibold">Privacy</span>
        </div>
        <p className="text-[12px] leading-snug" style={{ color: subtle }}>
          By clicking Submit, you agree to send your info to {businessName} who agrees to use it according to their privacy policy. Meta will also use it subject to the Meta Privacy Policy, including to autofill forms for ads.
        </p>

        <a
          href={data.privacy_policy_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 flex items-center justify-between px-3 py-2.5 rounded-md text-[12px] font-medium border"
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
          className="mt-2 flex items-center justify-between px-3 py-2.5 rounded-md text-[12px] font-medium border"
          style={{ borderColor: dark ? '#2a2a2a' : '#dadde1' }}
        >
          <span>View Meta Privacy Policy</span>
          <ExternalLink size={14} style={{ color: subtle }} />
        </a>
      </div>

      <div className="mt-auto px-4 pb-4 pt-2">
        <button
          onClick={(e) => { e.stopPropagation(); onSubmit(); }}
          className="w-full py-3 rounded-full text-[14px] font-semibold text-white"
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
  data, fbBlue, dark,
}: { data: MetaLeadFormData; fbBlue: string; dark: boolean }) {
  const subtle = dark ? '#a8a8a8' : '#65676b';
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-8 pb-4 flex flex-col items-center text-center gap-3">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ backgroundColor: fbBlue }}
        >
          <Check size={28} className="text-white" strokeWidth={3} />
        </div>
        <h2 className="text-[18px] font-bold leading-tight">
          {data.completion_headline?.trim() || 'Thanks, you’re all set.'}
        </h2>
        <p className="text-[13px] leading-snug whitespace-pre-wrap" style={{ color: subtle }}>
          {data.completion_description?.trim() || 'You can close this form now or visit our website.'}
        </p>
      </div>

      <div className="mt-auto px-4 pb-4 pt-2">
        <button
          className="w-full py-3 rounded-full text-[14px] font-semibold text-white"
          style={{ backgroundColor: fbBlue }}
          type="button"
        >
          {data.completion_button_label?.trim() || 'View Website'}
        </button>
      </div>
    </div>
  );
}
