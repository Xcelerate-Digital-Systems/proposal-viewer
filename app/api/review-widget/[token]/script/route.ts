// app/api/review-widget/[token]/script/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { iconsJS } from './parts/icons';
import { stylesJS } from './parts/styles';
import { coreJS } from './parts/core';
import { toolbarJS } from './parts/toolbar';
import { panelJS } from './parts/panel';
import { annotationFormJS } from './parts/annotation-form';
import { pinModeJS } from './parts/pin-mode';
import { boxModeJS } from './parts/box-mode';
import { textModeJS } from './parts/text-mode';
import { annotationsJS } from './parts/annotations';
import { initJS } from './parts/init';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const itemId = req.nextUrl.searchParams.get('item');
  if (!itemId) {
    return new NextResponse('/* AgencyViz: missing item param */', {
      status: 200,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    });
  }

  const { data: project } = await supabaseAdmin
    .from('review_projects')
    .select('id, title, status')
    .eq('share_token', params.token)
    .single();

  if (!project || project.status === 'archived') {
    return new NextResponse('/* AgencyViz: invalid or archived project */', {
      status: 200,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    });
  }

  const { data: item } = await supabaseAdmin
    .from('review_items')
    .select('id, title, url, type')
    .eq('id', itemId)
    .eq('review_project_id', project.id)
    .eq('type', 'webpage')
    .single();

  if (!item) {
    return new NextResponse('/* AgencyViz: invalid item */', {
      status: 200,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    });
  }

  const apiBase = process.env.NEXT_PUBLIC_APP_URL || 'https://app.agencyviz.com';

  const js = buildWidgetScript({
    token: params.token,
    itemId: item.id,
    apiBase,
  });

  return new NextResponse(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/* ── Assemble widget script from parts ──────────────────── */
function buildWidgetScript(c: {
  token: string;
  itemId: string;
  apiBase: string;
}) {
  return [
    '(function(){\n"use strict";\nif(window.__aviz_widget)return;\nwindow.__aviz_widget=true;\n',
    iconsJS(),
    stylesJS(c.apiBase),
    coreJS(c),
    toolbarJS(),
    panelJS(),
    annotationFormJS(),
    pinModeJS(),
    boxModeJS(),
    textModeJS(),
    annotationsJS(),
    initJS(),
    '\n})();',
  ].join('\n');
}