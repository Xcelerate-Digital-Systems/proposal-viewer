// app/api/review-widget/[token]/script/parts/pin-mode.ts

export function pinModeJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   PIN MODE
   ══════════════════════════════════════════════════════════ */
document.addEventListener("click",function(e){
  if(mode!=="pin")return;
  var t=e.target;if(t.closest("#aviz-root")||t.closest(".aviz-pin")||t.closest(".aviz-pin-form")||t.closest(".aviz-box")||t.closest(".aviz-text-ann")||t.closest(".aviz-text-input"))return;
  e.preventDefault();e.stopPropagation();
  var sx=window.pageXOffset||document.documentElement.scrollLeft;
  var sy=window.pageYOffset||document.documentElement.scrollTop;
  var px=e.clientX+sx,py=e.clientY+sy;
  exitMode();setActiveTool(null);
  showAnnotationForm("pin",px,py);
},true);
`;
}