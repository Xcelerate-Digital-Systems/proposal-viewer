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
    if(mode==="box"||mode==="text"){armPinMode();return;}
    if(panelOpen){closePanel();return;}
  }
});

/* ── Polling ────────────────────────────────────────────── */
function startPolling(){if(pollTimer)return;pollTimer=setInterval(function(){loadComments(refresh);},30000);}
function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}
document.addEventListener("visibilitychange",function(){if(document.hidden)stopPolling();else{loadComments(refresh);startPolling();}});

/* ── Init ───────────────────────────────────────────────── */
document.documentElement.classList.add("aviz-active");
armPinMode();
/* Load existing comments + start polling, but leave the panel closed
   on first paint -- reviewers found it intrusive to land with a 360px
   sidebar already covering part of the page. The Comments toolbar
   button still surfaces an unread badge so they know feedback is
   waiting, and existing pin/box/text markers on the page open the
   panel via their own click handlers when interacted with. */
loadComments(function(){refresh();startPolling();});
if(!guestName){
  /* Delay onboarding slightly so the page isn't blocked on first paint. */
  setTimeout(function(){if(!guestName&&typeof showOnboard==="function")showOnboard();},600);
}else if(typeof hasSeenTour==="function"&&!hasSeenTour()){
  /* Returning guest who already entered their name but hasn't seen the
     tool tour yet (e.g. onboarding existed before the tour shipped). */
  setTimeout(function(){if(typeof startTour==="function")startTour();},800);
}
`;
}