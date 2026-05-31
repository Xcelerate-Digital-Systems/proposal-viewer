// components/tours/TourProvider.tsx
// Single client-side provider that powers all in-app tours.
//
// Responsibilities:
//   • On pathname change, decide whether to auto-launch a tour the current
//     user hasn't seen yet (driven by team_members.tours_completed).
//   • Check for a "pending tour" in sessionStorage (written by the
//     SetupChecklist when navigating to a tour's page).
//   • Render Joyride when a tour is active — scrolls the page to each
//     target element automatically.
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
  useRef,
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
import { TourTooltip } from './TourTooltip';

/* ── Per-tab dismissed-set persistence ──────────────────────────────────
 * AdminLayout (and TourProvider with it) unmounts on every page
 * navigation, so any in-memory ref resets and the auto-launch effect
 * re-fires the tour on return to /dashboard until the DB-persisted
 * tours_completed value has finished propagating through useAuth's
 * fetchMemberships. sessionStorage gives us a synchronous per-tab cache
 * that survives navigation, clears on tab close, and (because we key by
 * user id) doesn't leak between users who log in/out in the same tab. */

const STORAGE_KEY_PREFIX = 'agencyviz_tours_dismissed:';
const PENDING_TOUR_KEY = 'agencyviz_pending_tour';

function storageKey(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return STORAGE_KEY_PREFIX + userId;
}

function readDismissed(userId: string | null | undefined): Set<string> {
  const key = storageKey(userId);
  if (!key || typeof window === 'undefined') return new Set();
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeDismissed(userId: string | null | undefined, ids: Set<string>): void {
  const key = storageKey(userId);
  if (!key || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(Array.from(ids)));
  } catch {
    /* quota / privacy mode — harmless */
  }
}

/** Write a pending tour that TourProvider picks up after navigation. */
export function setPendingTour(id: TourId): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_TOUR_KEY, id);
  } catch {
    /* harmless */
  }
}

function consumePendingTour(): TourId | null {
  if (typeof window === 'undefined') return null;
  try {
    const id = window.sessionStorage.getItem(PENDING_TOUR_KEY) as TourId | null;
    if (id) window.sessionStorage.removeItem(PENDING_TOUR_KEY);
    return id;
  } catch {
    return null;
  }
}

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
  const dismissedRef = useRef<Set<string>>(new Set());
  const pendingCheckedRef = useRef(false);

  const userId = auth.session?.user?.id ?? null;

  useEffect(() => {
    dismissedRef.current = readDismissed(userId);
  }, [userId]);

  const completed =
    (auth.teamMember?.tours_completed as Record<string, string> | undefined) ?? {};

  // Check for a pending tour (written by SetupChecklist before navigating).
  // Runs once after auth resolves. Takes priority over auto-launch.
  useEffect(() => {
    if (auth.loading || !auth.teamMember) return;
    if (pendingCheckedRef.current) return;
    pendingCheckedRef.current = true;

    const pending = consumePendingTour();
    if (!pending) return;
    const tour = getTour(pending);
    if (!tour || tour.steps.length === 0) return;
    // Small delay to let the page render its data-tour targets
    const timer = setTimeout(() => {
      setActiveId(pending);
      setSteps(tour.steps);
    }, 400);
    return () => clearTimeout(timer);
  }, [auth.loading, auth.teamMember]);

  // Auto-launch when landing on a tracked path the user hasn't completed.
  useEffect(() => {
    if (auth.loading) return;
    if (!auth.teamMember) return;
    if (activeId) return;
    const candidate = resolveTourForPath(pathname);
    if (!candidate) return;
    if (completed[candidate]) return;
    if (dismissedRef.current.has(candidate)) return;
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
      if (data.type !== EVENTS.TOUR_END) return;

      const finishedId = activeId;
      if (finishedId) {
        dismissedRef.current.add(finishedId);
        writeDismissed(userId, dismissedRef.current);
      }
      setActiveId(null);
      setSteps([]);

      if (finishedId) {
        void markComplete(finishedId);
      }
    },
    [activeId, markComplete, userId],
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
          scrollToFirstStep
          onEvent={handleEvent}
          tooltipComponent={TourTooltip as never}
          floatingOptions={{
            flipOptions: { fallbackPlacements: ['bottom', 'top', 'left', 'right'] },
          }}
          options={{
            primaryColor: '#017C87',
            zIndex: 10000,
            arrowColor: '#ffffff',
            backgroundColor: '#ffffff',
            textColor: '#111827',
            overlayColor: 'rgba(4, 57, 70, 0.55)',
            showProgress: false,
            scrollOffset: 80,
            spotlightRadius: 12,
            spotlightPadding: 8,
            buttons: ['back', 'skip', 'primary'],
          }}
          styles={{
            overlay: {
              mixBlendMode: undefined as never,
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
