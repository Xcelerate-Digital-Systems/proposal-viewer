'use client';

import Link from 'next/link';
import { Paintbrush, ArrowUpRight } from 'lucide-react';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import CoverDesignPanel from '@/components/admin/builder-sections/CoverDesignPanel';
import type { CoverEditorEntity } from '@/components/admin/shared/cover-editor/CoverEditorTypes';
import type { EntityType } from './DesignTabTypes';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface CoverGroupProps {
  type: EntityType;
  basePath: string;
  coverEntity?: CoverEditorEntity;
  onCoverSave?: () => void;
  /* Live font overrides forwarded to CoverDesignPanel */
  liveTitleFontFamily: string | null;
  liveTitleFontWeight: string | null;
  liveFontHeadingFamily: string | null;
  liveFontHeadingWeight: string | null;
  liveFontBodyFamily: string | null;
  liveFontBodyWeight: string | null;
  liveFontButtonFamily: string | null;
  liveFontButtonWeight: string | null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CoverGroup({
  type,
  basePath,
  coverEntity,
  onCoverSave,
  liveTitleFontFamily,
  liveTitleFontWeight,
  liveFontHeadingFamily,
  liveFontHeadingWeight,
  liveFontBodyFamily,
  liveFontBodyWeight,
  liveFontButtonFamily,
  liveFontButtonWeight,
}: CoverGroupProps) {
  if (coverEntity) {
    return (
      <CoverDesignPanel
        type={type === 'document' ? 'document' : type}
        entity={coverEntity}
        onSave={onCoverSave}
        liveTitleFontFamily={liveTitleFontFamily}
        liveTitleFontWeight={liveTitleFontWeight}
        liveFontHeadingFamily={liveFontHeadingFamily}
        liveFontHeadingWeight={liveFontHeadingWeight}
        liveFontBodyFamily={liveFontBodyFamily}
        liveFontBodyWeight={liveFontBodyWeight}
        liveFontButtonFamily={liveFontButtonFamily}
        liveFontButtonWeight={liveFontButtonWeight}
      />
    );
  }

  return (
    <SectionCard
      title="Cover Design"
      description="Cover-specific colours, background image, and gradient."
      icon={<Paintbrush size={14} className="text-faint" />}
      action={
        <Link
          href={`${basePath}/cover`}
          className="flex items-center gap-1 text-xs font-medium text-teal hover:underline"
        >
          Open Cover tab <ArrowUpRight size={12} />
        </Link>
      }
    >
      <p className="text-xs text-faint">
        Cover design controls appear here when the page passes a cover entity.
      </p>
    </SectionCard>
  );
}
