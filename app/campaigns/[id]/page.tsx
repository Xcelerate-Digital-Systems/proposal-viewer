'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { ProjectType } from '@/lib/types/feedback';

export default function ReviewProjectRedirect(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('review_projects')
        .select('project_type')
        .eq('id', params.id)
        .single();

      const projectType: ProjectType = data?.project_type ?? 'campaign';

      switch (projectType) {
        case 'asset':
          router.replace(`/campaigns/${params.id}/review`);
          break;
        case 'website':
          router.replace(`/campaigns/${params.id}/sitemap`);
          break;
        default:
          router.replace(`/campaigns/${params.id}/kanban`);
      }
      setChecked(true);
    })();
  }, [params.id, router]);

  if (!checked) return null;
  return null;
}
