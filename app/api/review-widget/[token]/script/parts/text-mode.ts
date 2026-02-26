// app/api/review-widget/[token]/script/parts/text-mode.ts

export function textModeJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   TEXT MODE
   ══════════════════════════════════════════════════════════ */
document.addEventListener("click",function(e){
  if(mode!=="text")return;
  var t=e.target;if(t.closest("#aviz-root")||t.closest(".aviz-pin")||t.closest(".aviz-pin-form")||t.closest(".aviz-box")||t.closest(".aviz-text-ann")||t.closest(".aviz-text-input"))return;
  e.preventDefault();e.stopPropagation();
  var sx=window.pageXOffset,sy=window.pageYOffset;
  var px=e.clientX+sx,py=e.clientY+sy;

  var inp=document.createElement("input");inp.type="text";inp.className="aviz-text-input";inp.placeholder="Type your note\\u2026";
  inp.style.left=px+"px";inp.style.top=py+"px";
  document.body.appendChild(inp);inp.focus();

  function finishText(){
    var val=inp.value.trim();
    inp.remove();
    if(!val)return;
    var label=document.createElement("div");label.className="aviz-text-ann pending";
    label.style.left=px+"px";label.style.top=py+"px";
    label.innerHTML='<span class="aviz-text-num">+</span><span class="aviz-text-label">'+esc(val)+'</span>';
    document.body.appendChild(label);
    exitMode();setActiveTool(null);
    showAnnotationForm("text",px+30,py,{x:pxToPctX(px),y:pxToPctY(py),overlay_text:val,el:label});
  }
  inp.addEventListener("keydown",function(ev){
    if(ev.key==="Enter"){ev.preventDefault();finishText();}
    if(ev.key==="Escape"){inp.remove();exitMode();setActiveTool(null);}
  });
  inp.addEventListener("blur",function(){setTimeout(finishText,100);});
},true);
`;
}