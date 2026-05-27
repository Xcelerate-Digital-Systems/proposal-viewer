// components/tours/ReplayButton.tsx
// Small "?" icon button that re-launches a tour on demand. Drop one in
// the header of any section that has a tour registered.

'use client';

import { HelpCircle } from 'lucide-react';
import { useTour } from './TourProvider';
import { getTour, type TourId } from './tour-config';

interface ReplayButtonProps {
  tourId: TourId;
  className?: string;
}

export function ReplayButton({ tourId, className }: ReplayButtonProps) {
  const { replay } = useTour();
  const tour = getTour(tourId);
  // Don't render a button for stub tours that have no steps yet.
  if (!tour || tour.steps.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() => replay(tourId)}
      aria-label={`Replay ${tour.label}`}
      title={`Replay ${tour.label}`}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-faint hover:text-teal hover:bg-teal/5 transition-colors ${className ?? ''}`}
    >
      <HelpCircle size={16} />
    </button>
  );
}
