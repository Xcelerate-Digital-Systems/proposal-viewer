// app/api/review-widget/[token]/script/parts/box-mode.ts

export function boxModeJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   BOX MODE
   ══════════════════════════════════════════════════════════ */
document.addEventListener("mousedown",function(e){
  if(mode!=="box")return;
  var t=e.target;if(t.closest("#aviz-root")||t.closest(".aviz-pin")||t.closest(".aviz-pin-form")||t.closest(".aviz-box")||t.closest(".aviz-text-ann"))return;
  e.preventDefault();e.stopPropagation();
  document.documentElement.style.userSelect="none";document.documentElement.style.webkitUserSelect="none";
  var sx=window.pageXOffset,sy=window.pageYOffset;
  boxStart={x:e.clientX+sx,y:e.clientY+sy};
  boxEl=document.createElement("div");boxEl.className="aviz-draw-box";
  boxEl.style.left=boxStart.x+"px";boxEl.style.top=boxStart.y+"px";boxEl.style.width="0";boxEl.style.height="0";
  document.body.appendChild(boxEl);boxDrawing=true;
},true);
document.addEventListener("mousemove",function(e){
  if(!boxDrawing||!boxStart||!boxEl)return;
  e.preventDefault();e.stopPropagation();
  var sx=window.pageXOffset,sy=window.pageYOffset;
  var cx=e.clientX+sx,cy=e.clientY+sy;
  var x=Math.min(boxStart.x,cx),y=Math.min(boxStart.y,cy);
  var w=Math.abs(cx-boxStart.x),h=Math.abs(cy-boxStart.y);
  boxEl.style.left=x+"px";boxEl.style.top=y+"px";boxEl.style.width=w+"px";boxEl.style.height=h+"px";
},true);
document.addEventListener("mouseup",function(e){
  if(!boxDrawing||!boxStart||!boxEl)return;
  e.preventDefault();e.stopPropagation();
  document.documentElement.style.userSelect="";document.documentElement.style.webkitUserSelect="";
  boxDrawing=false;
  var sx=window.pageXOffset,sy=window.pageYOffset;
  var cx=e.clientX+sx,cy=e.clientY+sy;
  var x=Math.min(boxStart.x,cx),y=Math.min(boxStart.y,cy);
  var w=Math.abs(cx-boxStart.x),h=Math.abs(cy-boxStart.y);

  if(w<20||h<20){boxEl.remove();boxEl=null;boxStart=null;return;}

  boxEl.className="aviz-box pending";boxEl.style.borderStyle="solid";
  var savedBox=boxEl;boxEl=null;
  exitMode();setActiveTool(null);
  showAnnotationForm("box",x+w/2,y,{x:pxToPctX(x),y:pxToPctY(y),w:pxToPctX(w),h:pxToPctY(h),el:savedBox});
},true);
`;
}