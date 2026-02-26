// app/api/review-widget/[token]/script/parts/init.ts

export function initJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   KEYBOARD, POLLING, INIT
   ══════════════════════════════════════════════════════════ */

/* ── Escape key ─────────────────────────────────────────── */
document.addEventListener("keydown",function(e){
  if(e.key==="Escape"){
    if(ssOverlay.classList.contains("show")){closeSS();return;}
    if(pendingAnnotation){removePendingAnnotation();return;}
    if(mode!=="idle"){exitMode();setActiveTool(null);return;}
    if(panelOpen){closePanel();return;}
  }
});

/* ── Polling ────────────────────────────────────────────── */
function startPolling(){if(pollTimer)return;pollTimer=setInterval(function(){loadComments(refresh);},30000);}
function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}
document.addEventListener("visibilitychange",function(){if(document.hidden)stopPolling();else{loadComments(refresh);startPolling();}});

/* ── Init ───────────────────────────────────────────────── */
loadComments(function(){refresh();startPolling();});
`;
}