// components/reviews/ReviewNotFound.tsx
'use client';

import { Link2Off } from 'lucide-react';

interface ReviewNotFoundProps {
  /** 'not_found' for invalid tokens, 'error' for server errors */
  type?: 'not_found' | 'error';
}

/**
 * Shared "not found" page for all public review routes.
 *
 * Displayed when:
 * - The share token is invalid or has been revoked
 * - The project/item no longer exists
 * - A server error occurred while loading
 *
 * Uses a neutral design (no branding) since we can't load company
 * branding without a valid project.
 */
export default function ReviewNotFound({ type = 'not_found' }: ReviewNotFoundProps) {
  const isError = type === 'error';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
          <Link2Off size={28} className="text-gray-400" />
        </div>

        {/* Heading */}
        <h1 className="text-xl font-semibold text-gray-800 mb-2">
          {isError ? 'Something went wrong' : 'This link is no longer active'}
        </h1>

        {/* Description */}
        <p className="text-sm text-gray-500 leading-relaxed">
          {isError
            ? 'We had trouble loading this page. Please try again in a moment.'
            : 'The shared link you followed may have been revoked or the content has been removed. Contact the person who shared it with you for an updated link.'}
        </p>
      </div>
    </div>
  );
}