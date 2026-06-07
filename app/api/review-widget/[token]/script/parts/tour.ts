// app/api/review-widget/[token]/script/parts/tour.ts

export function tourJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   FIRST-VISIT GUIDED TOUR
   Spotlights each toolbar button with a callout explainer.
   Shown once per reviewer (localStorage-gated).
   ══════════════════════════════════════════════════════════ */
var TOUR_KEY="aviz_tour_v1";
var tourBackdrop=null;
var tourCallout=null;
var tourStepIdx=0;

var tourSteps=[
  {tool:"pin",      title:"Drop a pin",         body:"Click anywhere on the page to drop a pin and leave feedback on that exact spot. The marker can be dragged after placing."},
  {tool:"box",      title:"Draw a box",         body:"Click and drag to draw a box around a larger area you want to give feedback on."},
  {tool:"text",     title:"Add a text note",    body:"Drop an inline text label anywhere on the page \\u2014 great for quick annotations."},
  {tool:"highlight",title:"Highlight text",     body:"Select any text on the page to attach feedback to that passage."},
  {tool:"video",    title:"Record a video",     body:"Record your screen \\u2014 with your voice if you like \\u2014 to walk through feedback visually. Ideal for flows that are hard to describe in writing."},
  {tool:"comments", title:"View all feedback",  body:"Open this panel to see everything submitted on the page, reply on threads, and mark items as resolved."}
];

function hasSeenTour(){try{return localStorage.getItem(TOUR_KEY)==="1";}catch(e){return false;}}
function markTourSeen(){try{localStorage.setItem(TOUR_KEY,"1");}catch(e){}}

function startTour(){
  if(hasSeenTour())return;
  if(tourBackdrop)return;
  tourBackdrop=document.createElement("div");
  tourBackdrop.id="aviz-tour-backdrop";
  document.body.appendChild(tourBackdrop);
  document.documentElement.classList.add("aviz-tour-on");
  tourStepIdx=0;
  showTourStep();
  window.addEventListener("resize",repositionTourCallout);
  window.addEventListener("scroll",repositionTourCallout,true);
}

function showTourStep(){
  Object.keys(toolBtns).forEach(function(k){toolBtns[k].classList.remove("aviz-tour-target");});
  if(tourCallout){tourCallout.remove();tourCallout=null;}

  var step=tourSteps[tourStepIdx];
  if(!step){endTour();return;}
  var btn=toolBtns[step.tool];
  /* Gracefully skip any step whose tool isn't mounted (e.g. disabled). */
  if(!btn){tourStepIdx++;showTourStep();return;}
  btn.classList.add("aviz-tour-target");

  var total=tourSteps.length;
  var isLast=tourStepIdx===total-1;
  tourCallout=document.createElement("div");
  tourCallout.className="aviz-tour-callout";
  tourCallout.innerHTML=
    '<div class="aviz-tour-step">Step '+(tourStepIdx+1)+' of '+total+'</div>'
    +'<h4>'+esc(step.title)+'</h4>'
    +'<p>'+esc(step.body)+'</p>'
    +'<div class="aviz-tour-actions">'
      +'<button type="button" class="aviz-tour-skip">'+(isLast?"":"Skip tour")+'</button>'
      +'<button type="button" class="aviz-tour-next">'+(isLast?"Got it":"Next")+'</button>'
    +'</div>'
    +'<span class="aviz-tour-arrow"></span>';
  document.body.appendChild(tourCallout);
  repositionTourCallout();

  tourCallout.querySelector(".aviz-tour-next").addEventListener("click",function(){
    tourStepIdx++;
    if(tourStepIdx>=tourSteps.length)endTour();
    else showTourStep();
  });
  var skip=tourCallout.querySelector(".aviz-tour-skip");
  if(isLast)skip.style.visibility="hidden";
  else skip.addEventListener("click",function(){endTour();});
}

function repositionTourCallout(){
  if(!tourCallout)return;
  var step=tourSteps[tourStepIdx];if(!step)return;
  var btn=toolBtns[step.tool];if(!btn)return;
  var rect=btn.getBoundingClientRect();
  var cRect=tourCallout.getBoundingClientRect();
  var gap=18;
  /* Toolbar is horizontal at the bottom — callout appears ABOVE the button,
     centred horizontally. Falls back to below if no room above. */
  var top=rect.top-cRect.height-gap;
  var left=rect.left+rect.width/2-cRect.width/2;
  var flipped=false;
  if(top<12){top=rect.bottom+gap;flipped=true;}
  if(left<12)left=12;
  if(left+cRect.width>window.innerWidth-12)left=window.innerWidth-cRect.width-12;
  tourCallout.style.top=top+"px";
  tourCallout.style.left=left+"px";
  tourCallout.classList.toggle("flipped",flipped);
}

function endTour(){
  markTourSeen();
  document.documentElement.classList.remove("aviz-tour-on");
  Object.keys(toolBtns).forEach(function(k){toolBtns[k].classList.remove("aviz-tour-target");});
  if(tourCallout){tourCallout.remove();tourCallout=null;}
  if(tourBackdrop){tourBackdrop.remove();tourBackdrop=null;}
  window.removeEventListener("resize",repositionTourCallout);
  window.removeEventListener("scroll",repositionTourCallout,true);
}
`;
}
