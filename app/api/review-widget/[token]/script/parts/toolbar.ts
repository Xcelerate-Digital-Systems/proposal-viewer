// app/api/review-widget/[token]/script/parts/toolbar.ts

export function toolbarJS(): string {
  return `
/* ── DOM setup ──────────────────────────────────────────── */
var root=document.createElement("div");root.id="aviz-root";document.body.appendChild(root);

/* ── Toolbar ────────────────────────────────────────────── */
var toolbar=document.createElement("div");toolbar.id="aviz-toolbar";
var tools=[
  {id:"pin",icon:ICON.pin,label:"Pin Comment"},
  {id:"box",icon:ICON.box,label:"Draw Box"},
  {id:"text",icon:ICON.text,label:"Add Text"},
  {id:"screenshot",icon:ICON.camera,label:"Screenshot"},
  {id:"sep1",sep:true},
  {id:"video",icon:ICON.video,label:"Record Video",soon:true},
  {id:"comments",icon:ICON.chat,label:"Comments"},
  {id:"questions",icon:ICON.help,label:"Questions",soon:true},
];
var toolBtns={};
tools.forEach(function(t){
  if(t.sep){var s=document.createElement("div");s.className="aviz-sep";toolbar.appendChild(s);return;}
  var btn=document.createElement("button");btn.className="aviz-tool";btn.setAttribute("data-tool",t.id);
  btn.innerHTML=t.icon;
  var tip=document.createElement("span");tip.className="aviz-tooltip";
  tip.innerHTML=esc(t.label)+(t.soon?'<span class="soon">Soon</span>':"");
  btn.appendChild(tip);
  if(t.id==="comments"){var bdg=document.createElement("span");bdg.className="aviz-badge";bdg.id="aviz-badge";btn.appendChild(bdg);}
  toolbar.appendChild(btn);toolBtns[t.id]=btn;
});
root.appendChild(toolbar);

/* ── Top bar ────────────────────────────────────────────── */
var bar=document.createElement("div");bar.id="aviz-bar";
bar.innerHTML='<span id="aviz-bar-msg">Click to place a pin</span><button id="aviz-bar-cancel">Cancel</button>';
root.appendChild(bar);
var barMsg=bar.querySelector("#aviz-bar-msg");

/* ── Mode management ────────────────────────────────────── */
function setMode(m,msg){
  exitMode();
  mode=m;
  if(m==="pin")document.documentElement.classList.add("aviz-mode-pin");
  if(m==="box")document.documentElement.classList.add("aviz-mode-box");
  if(m==="text")document.documentElement.classList.add("aviz-mode-text");
  if(msg){barMsg.textContent=msg;bar.classList.add("show");}
}
function exitMode(){
  mode="idle";
  document.documentElement.classList.remove("aviz-mode-pin","aviz-mode-box","aviz-mode-text");
  bar.classList.remove("show");
  removePendingAnnotation();
  if(boxEl){boxEl.remove();boxEl=null;}boxDrawing=false;boxStart=null;
}
function setActiveTool(id){
  activeTool=id;
  Object.keys(toolBtns).forEach(function(k){toolBtns[k].classList.toggle("active",k===id);});
}
bar.querySelector("#aviz-bar-cancel").addEventListener("click",function(){exitMode();setActiveTool(null);});

/* ── Toolbar click handlers ─────────────────────────────── */
toolBtns.pin.addEventListener("click",function(){
  if(mode==="pin"){exitMode();setActiveTool(null);return;}
  closePanel();setActiveTool("pin");setMode("pin","Click anywhere to place a pin");
});
toolBtns.box.addEventListener("click",function(){
  if(mode==="box"){exitMode();setActiveTool(null);return;}
  closePanel();setActiveTool("box");setMode("box","Click and drag to draw a box");
});
toolBtns.text.addEventListener("click",function(){
  if(mode==="text"){exitMode();setActiveTool(null);return;}
  closePanel();setActiveTool("text");setMode("text","Click anywhere to add text");
});
toolBtns.screenshot.addEventListener("click",function(){
  exitMode();setActiveTool("screenshot");captureScreenshot();
});
toolBtns.video.addEventListener("click",function(){/* soon */});
toolBtns.comments.addEventListener("click",function(){
  exitMode();
  if(panelOpen){closePanel();}else{openPanel();}
});
toolBtns.questions.addEventListener("click",function(){/* soon */});

/* ── Element hover highlight (always on, debounced) ─────── */
var hlTags=["P","H1","H2","H3","H4","H5","H6","SPAN","A","BUTTON","IMG","TD","TH","LI","SECTION","DIV","HEADER","FOOTER","NAV","MAIN","ARTICLE"];
document.addEventListener("mousemove",function(e){
  var t=e.target;
  if(t.closest("#aviz-root")||t.closest(".aviz-pin")||t.closest(".aviz-box")||t.closest(".aviz-text-ann")||t.closest(".aviz-pin-form")||t.closest(".aviz-text-input"))return;

  /* Same element — do nothing */
  if(t===highlightEl)return;

  /* Remove old highlight */
  if(highlightEl){highlightEl.classList.remove("aviz-el-hl");highlightEl=null;}

  /* Add new highlight if it's a suitable element */
  if(hlTags.indexOf(t.tagName)>-1){
    var r=t.getBoundingClientRect();
    if(r.width>30&&r.height>15){t.classList.add("aviz-el-hl");highlightEl=t;}
  }
});
`;
}