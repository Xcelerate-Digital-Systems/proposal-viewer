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

/* ── Verify + install-screenshot ─────────────────────────── */
/* Replaces the old Image() beacon. The server responds with JSON indicating
   whether a preview screenshot is still missing; if so, we capture one now. */
try{
  var verifyUrl=C.api.replace("/comments","/verify")+"?item="+C.item+"&format=json";
  fetch(verifyUrl,{headers:{"Accept":"application/json"}})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d&&d.needs_screenshot){
        /* Wait a beat for fonts/images to render. */
        setTimeout(function(){
          captureInstallScreenshot(function(dataUrl){
            if(!dataUrl)return;
            uploadScreenshot(dataUrl,function(){},{install:true});
          });
        },1500);
      }
    })
    .catch(function(){});
}catch(e){}

/* ── Init ───────────────────────────────────────────────── */
document.documentElement.classList.add("aviz-active");
armPinMode();
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