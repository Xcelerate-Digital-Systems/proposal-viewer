// components/tours/TourProvider.tsx
// Single client-side provider that powers all in-app tours.
//
// Responsibilities:
//   • On pathname change, decide whether to auto-launch a tour the current
//     user hasn't seen yet (driven by team_members.tours_completed).
//   • Render Joyride when a tour is active.
//   • On finish/skip, PATCH /api/team-members/me so the same tour never
//     auto-fires for this user again, then refresh useAuth memberships so
//     the cached state matches.
//   • Expose `replay(id)` via context so a section's "?" ReplayButton can
//     force-launch its tour.

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  Joyride,
  type EventData,
  type Step,
  EVENTS,
} from 'react-joyride';
import { useAuth } from '@/hooks/useAuth';
import { authFetch } from '@/lib/auth-fetch';
import { getTour, resolveTourForPath, type TourId } from './tour-config';

type Ctx = {
  replay: (id: TourId) => void;
  isActive: boolean;
};

const TourCtx = createContext<Ctx>({ replay: () => {}, isActive: false });

export function useTour(): Ctx {
  return useContext(TourCtx);
}

export function TourProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();

  const [activeId, setActiveId] = useState<TourId | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);

  const completed =
    (auth.teamMember?.tours_completed as Record<string, string> | undefined) ?? {};

  // Auto-launch when landing on a tracked path the user hasn't completed.
  // Don't fire while auth or memberships are still resolving — otherwise
  // we'd see the tour at the very moment the user is being kicked over
  // to /login or /onboarding.
  useEffect(() => {
    if (auth.loading) return;
    if (!auth.teamMember) return;
    if (activeId) return;
    const candidate = resolveTourForPath(pathname);
    if (!candidate) return;
    if (completed[candidate]) return;
    const tour = getTour(candidate);
    if (!tour || tour.steps.length === 0) return;
    setActiveId(candidate);
    setSteps(tour.steps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, auth.loading, auth.teamMember, activeId]);

  const markComplete = useCallback(
    async (id: TourId) => {
      await authFetch('/api/team-members/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tours_completed: { [id]: new Date().toISOString() },
        }),
      }).catch(() => {});
      if (auth.session?.user) {
        await auth.refreshMemberships(auth.session.user.id);
      }
    },
    [auth.session, auth.refreshMemberships],
  );

  const handleEvent = useCallback(
    (data: EventData) => {
      // TOUR_END fires once for a tour completing naturally OR being skipped /
      // closed. That's the single terminal signal we care about.
      if (data.type !== EVENTS.TOUR_END) return;

      const finishedId = activeId;
      setActiveId(null);
      setSteps([]);

      if (finishedId) {
        // Persist completion. Fire-and-forget — failure here just means the
        // user might see the tour again next visit, which is harmless.
        void markComplete(finishedId);
      }
    },
    [activeId, markComplete],
  );

  const replay = useCallback((id: TourId) => {
    const tour = getTour(id);
    if (!tour || tour.steps.length === 0) return;
    setActiveId(id);
    setSteps(tour.steps);
  }, []);

  return (
    <TourCtx.Provider value={{ replay, isActive: activeId !== null }}>
      {steps.length > 0 && (
        <Joyride
          steps={steps}
          run
          continuous
          onEvent={handleEvent}
          options={{
            primaryColor: '#017C87',
            zIndex: 10000,
            arrowColor: '#ffffff',
            backgroundColor: '#ffffff',
            textColor: '#111827',
            overlayColor: 'rgba(0, 0, 0, 0.4)',
            showProgress: true,
            buttons: ['back', 'skip', 'primary'],
          }}
          styles={{
            tooltip: {
              borderRadius: 12,
              padding: 16,
            },
            buttonPrimary: {
              borderRadius: 8,
              fontSize: 13,
              padding: '8px 14px',
            },
            buttonBack: {
              fontSize: 13,
              color: '#6b7280',
            },
            buttonSkip: {
              fontSize: 12,
              color: '#9ca3af',
            },
          }}
          locale={{
            back: 'Back',
            close: 'Close',
            last: 'Got it',
            next: 'Next',
            skip: 'Skip tour',
          }}
        />
      )}
      {children}
    </TourCtx.Provider>
  );
}
