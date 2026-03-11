// components/viewer/ViewerModals.tsx
'use client';

import AcceptModal from './AcceptModal';
import FeedbackModal from './FeedbackModal';

interface ViewerModalsProps {
  proposal: Record<string, unknown>;
  accent: string;
  bgSecondary: string;
  sidebarText: string;
  acceptTextColor: string;
  // Accept
  showAcceptModal: boolean;
  onCloseAccept: () => void;
  onAccept: (name: string) => Promise<void>;
  // Decline
  showDeclineModal: boolean;
  onCloseDecline: () => void;
  onDecline: (name: string, reason: string) => Promise<void>;
  // Revision
  showRevisionModal: boolean;
  onCloseRevision: () => void;
  onRevision: (name: string, notes: string) => Promise<void>;
}

export default function ViewerModals({
  proposal, accent, bgSecondary, sidebarText, acceptTextColor,
  showAcceptModal, onCloseAccept, onAccept,
  showDeclineModal, onCloseDecline, onDecline,
  showRevisionModal, onCloseRevision, onRevision,
}: ViewerModalsProps) {
  return (
    <>
      {showAcceptModal && (
        <AcceptModal
          title={proposal.title as string}
          onAccept={onAccept}
          onClose={onCloseAccept}
          accentColor={accent}
          bgColor={bgSecondary}
          textColor={sidebarText}
          acceptTextColor={acceptTextColor}
          buttonText={(proposal.accept_button_text as string) ?? undefined}
          postAcceptAction={((proposal.post_accept_action as string) ?? null) as 'redirect' | 'message' | null}
          postAcceptRedirectUrl={(proposal.post_accept_redirect_url as string) ?? null}
          postAcceptMessage={(proposal.post_accept_message as string) ?? null}
        />
      )}
      {showDeclineModal && (
        <FeedbackModal
          mode="decline"
          title={proposal.title as string}
          onSubmit={onDecline}
          onClose={onCloseDecline}
          accentColor={accent}
          bgColor={bgSecondary}
          textColor={sidebarText}
          acceptTextColor={acceptTextColor}
        />
      )}
      {showRevisionModal && (
        <FeedbackModal
          mode="revision"
          title={proposal.title as string}
          onSubmit={onRevision}
          onClose={onCloseRevision}
          accentColor={accent}
          bgColor={bgSecondary}
          textColor={sidebarText}
          acceptTextColor={acceptTextColor}
        />
      )}
    </>
  );
}
