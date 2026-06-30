'use client';

import { Package } from 'lucide-react';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import PackagesDesignPanel from '@/components/admin/builder-sections/PackagesDesignPanel';
import type { EntityType } from './DesignTabTypes';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface PackageGroupProps {
  type: EntityType;
  entityId: string;
  entityKey: 'template_id' | 'proposal_id';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PackageGroup({ type, entityId, entityKey }: PackageGroupProps) {
  if (type === 'document') {
    return (
      <SectionCard
        title="Packages Design"
        description="Documents don't have packages pages."
        icon={<Package size={14} className="text-faint" />}
      >
        <p className="text-xs text-faint">Not applicable to documents.</p>
      </SectionCard>
    );
  }

  return (
    <PackagesDesignPanel
      entityId={entityId}
      entityKey={entityKey}
    />
  );
}
