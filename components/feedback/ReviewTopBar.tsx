'use client';

import { useState } from 'react';
import { MessageSquare, MousePointer2, ArrowRight, Pause } from 'lucide-react';
import CompleteFeedbackModal from './CompleteFeedbackModal';
import { fontFamily } from '@/lib/google-fonts';
import { getFeedbackStatusDef } from '@/lib/feedback/status';
import type { FeedbackItem, FeedbackStatus } from '@/lib/types/feedback';
import type { CompanyBranding } from '@/hooks/useProposal';

export type ReviewMode = 'comment' | 'browse';

interface ReviewTopBarProps {
  projectTitle: string;
  clientName?: string | null;
  projectStatus?: FeedbackStatus;
  commentsPaused?: boolean;
  shareToken: string;
  reviewerName: string;
  reviewerEmail: string;

  mode: ReviewMode;
  onModeChange: (next: ReviewMode) => void;

  accentColor?: string;
  logoUrl?: string | null;
  companyName?: string | null;
  fontHeading?: string | null;
  /** Optional full branding — when present, top bar uses sidebar colors like the whiteboard header. */
  branding?: CompanyBranding;

  /** When true, render the Finish button as disabled "Review submitted". */
  submitted: boolean;
  /** Called after the reviewer successfully posts their completion. */
  onSubmitted: () => void;
  /** All items in the project — used by the Finish modal to render a per-item
   *  status picker so the reviewer can resolve everything in one go. */
  items?: FeedbackItem[];
}

/**
 * Fixed top chrome on the public reviewer page. Houses project context
 * on the left, Comment/Browse mode toggle in the centre, and the reviewer
 * avatar + "Finish reviewing" button on the right.
 *
 * Browse mode gates pin placement in FeedbackDetailView; Comment mode is
 * the default and restores full pin/highlight behaviour.
 */
export default function ReviewTopBar({
  projectTitle,
  clientName,
  projectStatus,
  commentsPaused = false,
  shareToken,
  reviewerName,
  reviewerEmail,
  mode,
  onModeChange,
  accentColor = '#017C87',
  logoUrl,
  companyName,
  fontHeading,
  branding,
  submitted,
  onSubmitted,
  items,
}: ReviewTopBarProps) {
  const [showFinish, setShowFinish] = useState(false);
  const headingFont = fontHeading ? fontFamily(fontHeading) : undefined;
  const initials = (reviewerName.trim()[0] ?? 'R').toUpperCase();
  const statusDef = projectStatus ? getFeedbackStatusDef(projectStatus) : null;

  // When full branding is provided, mirror the whiteboard header (branded
  // sidebar bg + sidebar text). Otherwise fall back to the neutral white top bar.
  const branded = !!branding?.bg_secondary || !!branding?.sidebar_text_color;
  const bgSecondary = branding?.bg_secondary || '#141414';
  const sidebarText = branding?.sidebar_text_color || '#ffffff';
  const barStyle = branded
    ? { backgroundColor: bgSecondary, borderBottom: `1px solid ${sidebarText}15` }
    : undefined;
  const titleColor = branded ? { color: sidebarText } : undefined;
  const subtitleColor = branded ? { color: `${sidebarText}99` } : undefined;
  const dividerColor = branded ? { backgroundColor: `${sidebarText}25` } : undefined;
  const togglePillBg = branded ? { backgroundColor: `${sidebarText}15` } : undefined;
  const toggleInactive = branded ? { color: `${sidebarText}99` } : undefined;
  const toggleActive = branded ? { backgroundColor: `${sidebarText}26`, color: sidebarText } : undefined;

  return (
    <>
      <div
        className={`fixed top-0 inset-x-0 z-30 h-12 flex items-center px-4 gap-4 ${branded ? '' : 'bg-white border-b border-gray-100'}`}
        style={barStyle}
      >
        {/* Left — brand + project */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName ?? 'Brand'} className="h-6 w-auto max-w-[120px] object-contain" />
          ) : companyName ? (
            <span
              className={`text-sm font-semibold truncate ${branded ? '' : 'text-gray-900'}`}
              style={branded ? { ...titleColor, fontFamily: headingFont } : { fontFamily: headingFont }}
            >
              {companyName}
            </span>
          ) : null}
          {(logoUrl || companyName) && (
            <span className={`h-4 w-px ${branded ? '' : 'bg-gray-100'}`} style={dividerColor} />
          )}
          <div className="min-w-0 flex items-center gap-2">
            <span
              className={`text-sm font-medium truncate ${branded ? '' : 'text-gray-900'}`}
              style={titleColor}
            >
              {projectTitle}
            </span>
            {clientName && (
              <span
                className={`text-xs truncate hidden md:inline ${branded ? '' : 'text-gray-400'}`}
                style={subtitleColor}
              >
                · {clientName}
              </span>
            )}
            {statusDef && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${statusDef.bg} ${statusDef.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusDef.dot}`} />
                {statusDef.label}
              </span>
            )}
          </div>
        </div>

        {/* Centre — Comment / Browse toggle */}
        <div
          className={`flex items-center rounded-full p-0.5 shrink-0 ${branded ? '' : 'bg-[#F5F1EE]'}`}
          style={togglePillBg}
        >
          <button
            type="button"
            onClick={() => onModeChange('comment')}
            className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[12px] font-semibold transition-colors ${
              branded
                ? ''
                : mode === 'comment'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
            }`}
            style={branded ? (mode === 'comment' ? toggleActive : toggleInactive) : undefined}
          >
            <MessageSquare size={12} />
            Comment
          </button>
          <button
            type="button"
            onClick={() => onModeChange('browse')}
            className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[12px] font-semibold transition-colors ${
              branded
                ? ''
                : mode === 'browse'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
            }`}
            style={branded ? (mode === 'browse' ? toggleActive : toggleInactive) : undefined}
          >
            <MousePointer2 size={12} />
            Browse
          </button>
        </div>

        {/* Right — avatar + Finish */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold"
            style={{ backgroundColor: accentColor }}
            title={reviewerName || 'Reviewer'}
          >
            {initials}
          </div>
          {submitted ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-[12px] font-semibold">
              Review submitted
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setShowFinish(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[12px] font-semibold hover:brightness-110 transition-all shadow-sm"
              style={{ backgroundColor: accentColor }}
            >
              Finish reviewing
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>

      {commentsPaused && (
        <div className="fixed top-12 inset-x-0 z-20 bg-amber-50 border-b border-amber-200 text-amber-800 text-[12px] font-medium px-4 py-1.5 flex items-center justify-center gap-2">
          <Pause size={12} />
          The team has paused new comments for this review.
        </div>
      )}

      {showFinish && (
        <CompleteFeedbackModal
          shareToken={shareToken}
          reviewerName={reviewerName}
          reviewerEmail={reviewerEmail}
          accentColor={accentColor}
          items={items}
          mode="project"
          onClose={() => setShowFinish(false)}
          onSubmitted={onSubmitted}
        />
      )}
    </>
  );
}
