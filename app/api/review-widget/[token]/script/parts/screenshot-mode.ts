// app/api/review-widget/[token]/script/parts/screenshot-mode.ts

export function screenshotModeJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   SCREENSHOT MODE (full overlay with annotation tools)
   ══════════════════════════════════════════════════════════ */

/* ── Screenshot overlay DOM ─────────────────────────────── */
var ssOverlay=document.createElement("div");ssOverlay.id="aviz-ss-overlay";
ssOverlay.innerHTML='<div id="aviz-ss-toolbar"></div><div id="aviz-ss-canvas-wrap"></div>'
  +'<div id="aviz-ss-form"><h4>Describe the issue</h4>'
  +'<input class="aviz-inp" id="aviz-ss-name" placeholder="Your name" style="margin-bottom:6px"/>'
  +'<textarea class="aviz-ta" id="aviz-ss-text" placeholder="What needs attention?" style="min-height:48px"></textarea>'
  +'<div style="display:flex;gap:6px;margin-top:10px;justify-content:flex-end">'
  +'<button class="aviz-btn aviz-btn-g" id="aviz-ss-cancel">Cancel</button>'
  +'<button class="aviz-btn aviz-btn-p" id="aviz-ss-submit">Post Screenshot</button></div></div>';
root.appendChild(ssOverlay);

var ssToolbar=ssOverlay.querySelector("#aviz-ss-toolbar");
var ssCanvasWrap=ssOverlay.querySelector("#aviz-ss-canvas-wrap");
var ssForm=ssOverlay.querySelector("#aviz-ss-form");
var ssNameInp=ssOverlay.querySelector("#aviz-ss-name");
var ssTextInp=ssOverlay.querySelector("#aviz-ss-text");

/* Build SS toolbar buttons */
var SS_TOOLS=[
  {id:"cursor",svg:SS_ICON.cursor,title:"Select"},
  {id:"arrow",svg:SS_ICON.arrow,title:"Arrow"},
  {id:"rect",svg:SS_ICON.rect,title:"Rectangle"},
  {id:"pen",svg:SS_ICON.pen,title:"Pen"},
  {id:"sstext",svg:SS_ICON.sstext,title:"Text"},
  {id:"sep"},
  {id:"undo",svg:SS_ICON.undo,title:"Undo"},
  {id:"done",svg:SS_ICON.done,title:"Done"},
  {id:"close",svg:SS_ICON.discard,title:"Discard"},
];
var ssToolBtns={};
SS_TOOLS.forEach(function(t){
  if(t.id==="sep"){var sep=document.createElement("div");sep.className="aviz-ss-sep";ssToolbar.appendChild(sep);return;}
  var btn=document.createElement("button");btn.className="aviz-ss-tool"+(t.id==="close"?" danger":"");
  btn.innerHTML=t.svg;btn.title=t.title||"";
  ssToolbar.appendChild(btn);ssToolBtns[t.id]=btn;
});

/* ── Screenshot engine state ────────────────────────────── */
var ssCanvas=null;var ssCtx=null;var ssBaseImage=null;
var ssAnnots=[];var ssTool="arrow";var ssDrawing=false;
var ssStartX=0;var ssStartY=0;var ssCurrentPath=[];var ssTextInput=null;
var DRAW_COLOR="#FF3B30";var DRAW_WIDTH=3;

function captureScreenshot(){
  root.style.display="none";
  annotations.forEach(function(a){if(a.el)a.el.style.display="none";});
  loadH2C(function(){
    html2canvas(document.body,{
      useCORS:true,allowTaint:true,
      scrollX:-window.scrollX,scrollY:-window.scrollY,
      windowWidth:document.documentElement.clientWidth,
      windowHeight:document.documentElement.clientHeight,
      width:document.documentElement.clientWidth,
      height:document.documentElement.clientHeight,
      x:window.scrollX,y:window.scrollY
    }).then(function(canvas){
      root.style.display="";annotations.forEach(function(a){if(a.el)a.el.style.display="";});
      openSS(canvas);
    }).catch(function(err){
      root.style.display="";annotations.forEach(function(a){if(a.el)a.el.style.display="";});
      console.error("Screenshot failed:",err);alert("Screenshot capture failed.");setActiveTool(null);
    });
  });
}

function openSS(srcCanvas){
  ssAnnots=[];ssTool="arrow";updateSSActive();
  ssCanvas=document.createElement("canvas");
  ssCanvas.width=srcCanvas.width;ssCanvas.height=srcCanvas.height;
  ssCanvas.style.cursor="crosshair";
  ssCtx=ssCanvas.getContext("2d");
  ssBaseImage=new Image();ssBaseImage.src=srcCanvas.toDataURL("image/png");
  ssBaseImage.onload=function(){redrawSS();};
  ssCanvasWrap.innerHTML="";ssCanvasWrap.appendChild(ssCanvas);
  ssOverlay.classList.add("show");ssForm.classList.remove("show");
  ssCanvas.addEventListener("mousedown",ssDown);
  ssCanvas.addEventListener("mousemove",ssMove);
  ssCanvas.addEventListener("mouseup",ssUp);
  ssCanvas.addEventListener("touchstart",ssTStart,{passive:false});
  ssCanvas.addEventListener("touchmove",ssTMove,{passive:false});
  ssCanvas.addEventListener("touchend",ssTEnd);
}
function closeSS(){
  ssOverlay.classList.remove("show");ssForm.classList.remove("show");
  ssCanvasWrap.innerHTML="";ssCanvas=null;ssCtx=null;ssBaseImage=null;ssAnnots=[];
  if(ssTextInput){ssTextInput.remove();ssTextInput=null;}
  setActiveTool(null);
}
function updateSSActive(){
  Object.keys(ssToolBtns).forEach(function(k){
    if(k==="undo"||k==="done"||k==="close")return;
    ssToolBtns[k].classList.toggle("active",k===ssTool);
  });
  if(ssCanvas)ssCanvas.style.cursor=ssTool==="cursor"?"default":"crosshair";
}
function canvasXY(e){var r=ssCanvas.getBoundingClientRect();return{x:(e.clientX-r.left)*(ssCanvas.width/r.width),y:(e.clientY-r.top)*(ssCanvas.height/r.height)};}
function redrawSS(){
  if(!ssCtx||!ssBaseImage)return;
  ssCtx.clearRect(0,0,ssCanvas.width,ssCanvas.height);
  ssCtx.drawImage(ssBaseImage,0,0);
  ssAnnots.forEach(function(a){drawSSAnnot(ssCtx,a);});
}
function drawSSAnnot(ctx,a){
  ctx.save();ctx.strokeStyle=DRAW_COLOR;ctx.fillStyle=DRAW_COLOR;
  ctx.lineWidth=DRAW_WIDTH*(ssCanvas.width/window.innerWidth);
  ctx.lineCap="round";ctx.lineJoin="round";
  if(a.type==="arrow"){drawArrow(ctx,a.x1,a.y1,a.x2,a.y2);}
  else if(a.type==="rect"){ctx.strokeRect(a.x,a.y,a.w,a.h);}
  else if(a.type==="pen"&&a.points.length>1){ctx.beginPath();ctx.moveTo(a.points[0].x,a.points[0].y);for(var i=1;i<a.points.length;i++)ctx.lineTo(a.points[i].x,a.points[i].y);ctx.stroke();}
  else if(a.type==="text"){var fs=Math.max(16,Math.round(20*(ssCanvas.width/window.innerWidth)));ctx.font="600 "+fs+"px -apple-system,BlinkMacSystemFont,sans-serif";ctx.fillText(a.text,a.x,a.y);}
  ctx.restore();
}
function drawArrow(ctx,x1,y1,x2,y2){
  var hl=Math.max(12,15*(ssCanvas.width/window.innerWidth));var a=Math.atan2(y2-y1,x2-x1);
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x2,y2);
  ctx.lineTo(x2-hl*Math.cos(a-Math.PI/6),y2-hl*Math.sin(a-Math.PI/6));
  ctx.lineTo(x2-hl*Math.cos(a+Math.PI/6),y2-hl*Math.sin(a+Math.PI/6));
  ctx.closePath();ctx.fill();
}

/* ── Mouse/touch handlers ──────────────────────────────── */
function ssDown(e){
  if(ssTool==="cursor")return;
  if(ssTool==="sstext"){placeSSText(e);return;}
  var p=canvasXY(e);ssDrawing=true;ssStartX=p.x;ssStartY=p.y;
  if(ssTool==="pen")ssCurrentPath=[{x:p.x,y:p.y}];
}
function ssMove(e){
  if(!ssDrawing)return;var p=canvasXY(e);redrawSS();
  ssCtx.save();ssCtx.strokeStyle=DRAW_COLOR;ssCtx.fillStyle=DRAW_COLOR;
  ssCtx.lineWidth=DRAW_WIDTH*(ssCanvas.width/window.innerWidth);
  ssCtx.lineCap="round";ssCtx.lineJoin="round";
  if(ssTool==="arrow"){drawArrow(ssCtx,ssStartX,ssStartY,p.x,p.y);}
  else if(ssTool==="rect"){ssCtx.strokeRect(ssStartX,ssStartY,p.x-ssStartX,p.y-ssStartY);}
  else if(ssTool==="pen"){ssCurrentPath.push({x:p.x,y:p.y});ssCtx.beginPath();ssCtx.moveTo(ssCurrentPath[0].x,ssCurrentPath[0].y);for(var i=1;i<ssCurrentPath.length;i++)ssCtx.lineTo(ssCurrentPath[i].x,ssCurrentPath[i].y);ssCtx.stroke();}
  ssCtx.restore();
}
function ssUp(e){
  if(!ssDrawing)return;ssDrawing=false;var p=canvasXY(e);
  if(ssTool==="arrow"){var dx=p.x-ssStartX,dy=p.y-ssStartY;if(Math.sqrt(dx*dx+dy*dy)>5)ssAnnots.push({type:"arrow",x1:ssStartX,y1:ssStartY,x2:p.x,y2:p.y});}
  else if(ssTool==="rect"){var w=p.x-ssStartX,h=p.y-ssStartY;if(Math.abs(w)>5&&Math.abs(h)>5)ssAnnots.push({type:"rect",x:ssStartX,y:ssStartY,w:w,h:h});}
  else if(ssTool==="pen"&&ssCurrentPath.length>2){ssAnnots.push({type:"pen",points:ssCurrentPath.slice()});}
  ssCurrentPath=[];redrawSS();
}
function touchXY(e){var t=e.touches[0]||e.changedTouches[0];return{clientX:t.clientX,clientY:t.clientY};}
function ssTStart(e){e.preventDefault();ssDown(touchXY(e));}
function ssTMove(e){e.preventDefault();ssMove(touchXY(e));}
function ssTEnd(e){ssUp(touchXY(e));}

/* ── Text on screenshot ────────────────────────────────── */
function placeSSText(e){
  if(ssTextInput){commitSSText();return;}
  var p=canvasXY(e);var r=ssCanvas.getBoundingClientRect();var sx=r.width/ssCanvas.width;
  ssTextInput=document.createElement("input");ssTextInput.type="text";ssTextInput.placeholder="Type text...";
  ssTextInput.style.cssText="position:absolute;z-index:2147483650;font-size:16px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,sans-serif;"
    +"color:"+DRAW_COLOR+";background:rgba(255,255,255,.9);border:2px solid "+DRAW_COLOR+";border-radius:4px;padding:4px 8px;outline:none;"
    +"left:"+(r.left+p.x*sx)+"px;top:"+(r.top+p.y*sx-16)+"px;min-width:100px;";
  ssTextInput._cx=p.x;ssTextInput._cy=p.y;
  document.body.appendChild(ssTextInput);ssTextInput.focus();
  ssTextInput.addEventListener("keydown",function(ev){if(ev.key==="Enter")commitSSText();if(ev.key==="Escape"){ssTextInput.remove();ssTextInput=null;}});
}
function commitSSText(){
  if(!ssTextInput)return;var t=ssTextInput.value.trim();
  if(t)ssAnnots.push({type:"text",x:ssTextInput._cx,y:ssTextInput._cy,text:t});
  ssTextInput.remove();ssTextInput=null;redrawSS();
}

/* ── SS toolbar button wiring ──────────────────────────── */
["cursor","arrow","rect","pen","sstext"].forEach(function(id){
  if(ssToolBtns[id])ssToolBtns[id].addEventListener("click",function(){if(ssTextInput)commitSSText();ssTool=id;updateSSActive();});
});
ssToolBtns.undo.addEventListener("click",function(){if(ssTextInput){ssTextInput.remove();ssTextInput=null;return;}if(ssAnnots.length){ssAnnots.pop();redrawSS();}});
ssToolBtns.done.addEventListener("click",function(){if(ssTextInput)commitSSText();showSSForm();});
ssToolBtns.close.addEventListener("click",closeSS);

/* ── SS comment form ───────────────────────────────────── */
function showSSForm(){
  ssForm.classList.add("show");
  if(guestName){ssNameInp.value=guestName;ssNameInp.style.display="none";}
  else{ssNameInp.style.display="";ssNameInp.value="";}
  ssTextInp.value="";ssTextInp.focus();
}
ssOverlay.querySelector("#aviz-ss-cancel").addEventListener("click",function(){ssForm.classList.remove("show");});
ssOverlay.querySelector("#aviz-ss-submit").addEventListener("click",function(){
  var n=ssNameInp.style.display==="none"?guestName:ssNameInp.value.trim();
  var t=ssTextInp.value.trim();if(!n||!t)return;
  guestName=n;saveGuest();
  var btn=ssOverlay.querySelector("#aviz-ss-submit");btn.disabled=true;btn.textContent="Uploading\\u2026";
  if(ssTextInput)commitSSText();
  var dataUrl=ssCanvas.toDataURL("image/png");
  uploadScreenshot(dataUrl,function(url){
    postComment({author_name:n,content:t,comment_type:"screenshot",screenshot_url:url||null},function(d){
      btn.disabled=false;btn.textContent="Post Screenshot";
      closeSS();if(d){openPanel();refresh();}
    });
  });
});
ssTextInp.addEventListener("keydown",function(e){if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)){e.preventDefault();ssOverlay.querySelector("#aviz-ss-submit").click();}});
`;
}