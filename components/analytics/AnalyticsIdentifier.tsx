// components/analytics/AnalyticsIdentifier.tsx
//
// Tiny client component that identifies the signed-in user to PostHog as
// soon as we have their team_members row resolved. Re-runs on workspace
// switch so the `group` association follows. Renders nothing.

'use client';

import { useEffect } from 'react';
import { identifyAnalyticsUser } from './PostHogProvider';

interface Props {
  userId: string;
  email?: string;
  name?: string;
  companyId: string;
  role: string;
  accountType: 'agency' | 'client';
}

export function AnalyticsIdentifier({
  userId,
  email,
  name,
  companyId,
  role,
  accountType,
}: Props) {
  useEffect(() => {
    identifyAnalyticsUser({
      userId,
      email,
      name,
      companyId,
      role,
      accountType,
    });
  }, [userId, email, name, companyId, role, accountType]);

  return null;
}
