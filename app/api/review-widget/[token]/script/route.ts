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
import { highlightModeJS } from './parts/highlight-mode';
import { priorityMenuJS } from './parts/priority-menu';
import { videoModeJS } from './parts/video-mode';
import { annotationsJS } from './parts/annotations';
import { onboardingJS } from './parts/onboarding';
import { initJS } from './parts/init';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ItemRef = { id: string; url: string };

function jsResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const itemId = req.nextUrl.searchParams.get('item');

  const { data: project } = await supabaseAdmin
    .from('review_projects')
    .select('id, status')
    .eq('share_token', params.token)
    .single();

  if (!project || project.status === 'archived') {
    return jsResponse('/* AgencyViz: invalid or archived project */');
  }

  let pinnedItemId: string | null = null;
  let items: ItemRef[] = [];

  if (itemId) {
    // Legacy / explicit per-page install
    const { data: item } = await supabaseAdmin
      .from('review_items')
      .select('id')
      .eq('id', itemId)
      .eq('review_project_id', project.id)
      .eq('type', 'webpage')
      .single();

    if (!item) {
      return jsResponse('/* AgencyViz: invalid item */');
    }
    pinnedItemId = item.id;
  } else {
    // Project-wide install — emit the full list of webpage items and
    // resolve which one matches the current URL at runtime.
    const { data: rows } = await supabaseAdmin
      .from('review_items')
      .select('id, url')
      .eq('review_project_id', project.id)
      .eq('type', 'webpage')
      .not('url', 'is', null);

    items = (rows || [])
      .filter((r): r is { id: string; url: string } => typeof r.url === 'string' && r.url.length > 0);

    // Empty project is fine — the script still pings /heartbeat so the
    // setup wizard can confirm install before any pages are added.
  }

  const apiBase = process.env.NEXT_PUBLIC_APP_URL || 'https://app.agencyviz.com';

  const js = buildWidgetScript({
    token: params.token,
    pinnedItemId,
    items,
    apiBase,
  });

  return jsResponse(js);
}

/* ── Assemble widget script from parts ──────────────────── */
function buildWidgetScript(c: {
  token: string;
  pinnedItemId: string | null;
  items: ItemRef[];
  apiBase: string;
}) {
  const resolver = `
/* ══ AgencyViz: heartbeat + resolve feedback item from current URL ══ */
try{fetch("${c.apiBase}/api/review-widget/${c.token}/heartbeat",{method:"POST",keepalive:true}).catch(function(){});}catch(e){}
var __aviz_pinnedItem=${JSON.stringify(c.pinnedItemId)};
var __aviz_items=${JSON.stringify(c.items)};
var __aviz_resolvedItem=__aviz_pinnedItem||null;
if(!__aviz_resolvedItem && __aviz_items && __aviz_items.length){
  try{
    var __aviz_norm=function(u){
      var s=String(u||"");
      if(s.indexOf("://")===-1)s="https://"+s;
      var url=new URL(s);
      var host=(url.host||"").replace(/^www\\./i,"").toLowerCase();
      var path=(url.pathname||"").replace(/\\/+$/,"").toLowerCase();
      return host+path;
    };
    var __aviz_cur=__aviz_norm(window.location.href);
    if(__aviz_cur){
      for(var __aviz_i=0;__aviz_i<__aviz_items.length;__aviz_i++){
        var __aviz_it=__aviz_items[__aviz_i];
        if(!__aviz_it||!__aviz_it.url)continue;
        if(__aviz_norm(__aviz_it.url)===__aviz_cur){__aviz_resolvedItem=__aviz_it.id;break;}
      }
    }
  }catch(e){}
}
if(!__aviz_resolvedItem)return;
`;

  return [
    '(function(){\n"use strict";\nif(window.__aviz_widget)return;\nwindow.__aviz_widget=true;\n',
    resolver,
    iconsJS(),
    stylesJS(c.apiBase),
    coreJS({ token: c.token, apiBase: c.apiBase }),
    toolbarJS(),
    panelJS(),
    priorityMenuJS(),
    annotationFormJS(),
    pinModeJS(),
    boxModeJS(),
    textModeJS(),
    highlightModeJS(),
    videoModeJS(),
    annotationsJS(),
    onboardingJS(),
    initJS(),
    '\n})();',
  ].join('\n');
}
