// app/api/review-widget/[token]/script/parts/pin-mode.ts

export function pinModeJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   PIN MODE
   ══════════════════════════════════════════════════════════ */
document.addEventListener("click",function(e){
  if(mode!=="pin")return;
  /* A comment form is already open — ignore page clicks so the user
     can't accidentally drop a second pin while composing the first. */
  if(pendingAnnotation)return;
  var t=e.target;if(t.closest("#aviz-root")||t.closest("#aviz-onboard")||t.closest("#aviz-tour-backdrop")||t.closest(".aviz-tour-callout")||t.closest(".aviz-pin")||t.closest(".aviz-pin-form")||t.closest(".aviz-box")||t.closest(".aviz-text-ann")||t.closest(".aviz-text-input"))return;
  e.preventDefault();e.stopPropagation();
  var sx=window.pageXOffset||document.documentElement.scrollLeft;
  var sy=window.pageYOffset||document.documentElement.scrollTop;
  var px=e.clientX+sx,py=e.clientY+sy;
  /* Snapshot the anchor (element + offset) BEFORE we tear down anything,
     so the pin sticks to the element across future layout shifts. */
  var anchorEl=pickAnchorElement(e.clientX,e.clientY,t);
  var anchor=computeAnchor(anchorEl,px,py);
  exitMode();setActiveTool(null);
  showAnnotationForm("pin",px,py,anchor?{anchor:anchor}:null);
},true);
`;
}