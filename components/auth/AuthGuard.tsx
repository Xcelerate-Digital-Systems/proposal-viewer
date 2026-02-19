// components/auth/AuthGuard.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AuthGuardProps {
  children: (auth: ReturnType<typeof useAuth>) => React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading && !auth.session) {
      router.replace('/login');
    }
  }, [auth.loading, auth.session, router]);

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 text-[#017C87] animate-spin" />
      </div>
    );
  }

  if (!auth.session) return null;

  return <>{children(auth)}</>;
}