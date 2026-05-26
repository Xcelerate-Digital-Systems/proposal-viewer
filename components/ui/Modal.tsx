// components/ui/Modal.tsx
// Canonical modal/dialog primitive. Replaces ~20 hand-rolled modals that
// each picked their own backdrop opacity, z-index, border radius, header
// layout, close-button styling, and ESC/scroll-lock behaviour.
//
// Common case (title + close X auto-rendered in header):
//
//   <Modal open={open} onClose={close} title="Edit folder" size="md">
//     <Modal.Body>...form...</Modal.Body>
//     <Modal.Footer>
//       <Button variant="ghost" onClick={close}>Cancel</Button>
//       <Button onClick={save}>Save</Button>
//     </Modal.Footer>
//   </Modal>
//
// Custom header (omit `title` and provide <Modal.Header>):
//
//   <Modal open={open} onClose={close} size="lg">
//     <Modal.Header><CustomHeader /></Modal.Header>
//     <Modal.Body>...</Modal.Body>
//   </Modal>
//
'use client';

import { useEffect, useCallback, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided, renders a default header with the title + close X. */
  title?: string;
  size?: ModalSize;
  /** Close when the backdrop is clicked. Default: true. */
  closeOnBackdrop?: boolean;
  /** Close when Escape is pressed. Default: true. */
  closeOnEscape?: boolean;
  /** Override the standard `bg-black/50` backdrop, e.g. `bg-black/70` for
   *  image lightboxes. */
  backdropClassName?: string;
  /** Padding around the modal card. Default: `p-4`. */
  containerClassName?: string;
  children: ReactNode;
}

const sizeWidth: Record<ModalSize, string> = {
  sm: 'max-w-sm',     // 384px
  md: 'max-w-md',     // 448px
  lg: 'max-w-lg',     // 512px
  xl: 'max-w-2xl',    // 672px
  full: 'max-w-[90vw]',
};

function ModalRoot({
  open,
  onClose,
  title,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  backdropClassName = 'bg-black/50',
  containerClassName = 'p-4',
  children,
}: ModalProps) {
  // ESC key handler.
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, closeOnEscape, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!closeOnBackdrop) return;
      if (e.target === e.currentTarget) onClose();
    },
    [closeOnBackdrop, onClose],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={handleBackdrop}
      className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm animate-[fadeIn_150ms_ease-out] ${backdropClassName} ${containerClassName}`}
    >
      <div
        className={`relative w-full ${sizeWidth[size]} max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-modal overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <DefaultHeader title={title} onClose={onClose} />}
        {children}
      </div>
    </div>
  );
}

function DefaultHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-edge">
      <h2 className="text-base font-semibold text-ink truncate pr-3">{title}</h2>
      <Button variant="ghost" size="sm" iconOnly leftIcon={X} onClick={onClose} aria-label="Close" />
    </div>
  );
}

/** Custom header slot — replaces the auto-header that `title` would render. */
function ModalHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`shrink-0 px-6 py-4 border-b border-edge ${className}`}>{children}</div>
  );
}

/** Scrollable body content. Use this for the main form/content area. */
function ModalBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex-1 overflow-y-auto px-6 py-5 ${className}`}>{children}</div>
  );
}

/** Sticky bottom button row. Standard right-aligned, gap-2. */
function ModalFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-edge bg-paper ${className}`}>
      {children}
    </div>
  );
}

export const Modal = Object.assign(ModalRoot, {
  Header: ModalHeader,
  Body: ModalBody,
  Footer: ModalFooter,
});

export default Modal;
