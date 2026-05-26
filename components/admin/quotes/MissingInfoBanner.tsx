// components/admin/quotes/MissingInfoBanner.tsx
// Sticky amber banner that lists business-info fields the team hasn't filled
// out yet (ABN, phone, email, logo). These appear on the rendered quote, so
// a missing value is a quality signal — but it's not blocking, just nudging.
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface CompanyInfoLite {
  phone: string | null;
  contactEmail: string | null;
  abn: string | null;
  logoPath: string | null;
}

interface Props {
  companyInfo: CompanyInfoLite | null;
}

interface Missing {
  key: 'abn' | 'phone' | 'contactEmail' | 'logo';
  label: string;
  href: string;
}

function detectMissing(c: CompanyInfoLite): Missing[] {
  const out: Missing[] = [];
  if (!c.abn?.trim())          out.push({ key: 'abn',          label: 'ABN',          href: '/company' });
  if (!c.phone?.trim())        out.push({ key: 'phone',        label: 'phone number', href: '/company' });
  if (!c.contactEmail?.trim()) out.push({ key: 'contactEmail', label: 'contact email',href: '/company' });
  if (!c.logoPath?.trim())     out.push({ key: 'logo',         label: 'logo',         href: '/company' });
  return out;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export default function MissingInfoBanner({ companyInfo }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!companyInfo || dismissed) return null;
  const missing = detectMissing(companyInfo);
  if (missing.length === 0) return null;

  const labels = missing.map((m) => m.label);
  const settingsHref = missing[0].href;

  return (
    <div className="bg-amber-50 border-y border-amber-200 px-6 lg:px-10 py-2.5">
      <div className="flex items-center gap-3">
        <AlertCircle size={14} className="text-amber-600 shrink-0" />
        <p className="text-[13px] text-amber-900 flex-1">
          <span className="font-medium">
            Your {joinList(labels)} {missing.length === 1 ? 'is' : 'are'} missing.
          </span>{' '}
          <span className="text-amber-700">
            This info appears on your quotes.{' '}
            <Link href={settingsHref} className="underline decoration-dotted underline-offset-4 hover:no-underline">
              Update in Settings »
            </Link>
          </span>
        </p>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          leftIcon={X}
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="text-amber-600 hover:bg-amber-100"
        />
      </div>
    </div>
  );
}
