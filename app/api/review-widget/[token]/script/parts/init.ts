// app/api/review-widget/[token]/script/parts/init.ts

export function initJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   KEYBOARD, POLLING, INIT
   ══════════════════════════════════════════════════════════ */

/* ── Escape key ─────────────────────────────────────────── */
document.addEventListener("keydown",function(e){
  if(e.key==="Escape"){
    if(pendingAnnotation){removePendingAnnotation();return;}
    if(mode!=="idle"){exitMode();setActiveTool(null);return;}
    if(panelOpen){closePanel();return;}
  }
});

/* ── Polling ────────────────────────────────────────────── */
function startPolling(){if(pollTimer)return;pollTimer=setInterval(function(){loadComments(refresh);},30000);}
function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}
document.addEventListener("visibilitychange",function(){if(document.hidden)stopPolling();else{loadComments(refresh);startPolling();}});

/* ── Verify beacon (marks widget as installed) ──────────── */
try{
  var verifyUrl=C.api.replace("/comments","/verify")+"?item="+C.item;
  var beacon=new Image();beacon.src=verifyUrl;
}catch(e){}

/* ── Init ───────────────────────────────────────────────── */
document.documentElement.classList.add("aviz-active");
loadComments(function(){refresh();startPolling();});
`;
}