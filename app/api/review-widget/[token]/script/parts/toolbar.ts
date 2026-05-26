// app/api/review-widget/[token]/script/parts/toolbar.ts

export function toolbarJS(): string {
  return `
/* ── DOM setup ──────────────────────────────────────────── */
var root=document.createElement("div");root.id="aviz-root";document.body.appendChild(root);

/* ── Stack (wraps mode toggle + toolbar so they share a single
       right-edge anchor and slide together on mobile panel-open) ── */
var stack=document.createElement("div");stack.id="aviz-stack";

/* ── Mode toggle (Comment / Browse) ──────────────────────
   Top-level mode switch -- "Comment" arms pin and re-enables the
   annotation tools; "Browse" suppresses pin drops + the hover ring
   so the reviewer can interact with the page normally. The toggle
   lives above the toolbar so the choice is impossible to miss; the
   browse tile used to sit inside the toolbar column and reviewers
   couldn't tell it apart from the annotation tools. */
var modeToggle=document.createElement("div");modeToggle.id="aviz-mode-toggle";
var togglePills={
  comment:document.createElement("button"),
  browse:document.createElement("button")
};
togglePills.comment.type="button";togglePills.comment.className="aviz-toggle-pill active";
togglePills.comment.setAttribute("data-mode","comment");togglePills.comment.textContent="Comment";
togglePills.browse.type="button";togglePills.browse.className="aviz-toggle-pill";
togglePills.browse.setAttribute("data-mode","browse");togglePills.browse.textContent="Browse";
modeToggle.appendChild(togglePills.comment);modeToggle.appendChild(togglePills.browse);
stack.appendChild(modeToggle);

/* ── Toolbar ────────────────────────────────────────────── */
var toolbar=document.createElement("div");toolbar.id="aviz-toolbar";
var tools=[
  {id:"pin",icon:ICON.pin,label:"Pin Comment"},
  {id:"box",icon:ICON.box,label:"Draw Box"},
  {id:"text",icon:ICON.text,label:"Add Text"},
  {id:"sep1",sep:true},
  {id:"video",icon:ICON.video,label:"Record Video"},
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
stack.appendChild(toolbar);
root.appendChild(stack);

/* ── Top bar ────────────────────────────────────────────── */
var bar=document.createElement("div");bar.id="aviz-bar";
bar.innerHTML='<span id="aviz-bar-msg">Click to place a pin</span><button id="aviz-bar-cancel">Cancel</button>';
root.appendChild(bar);
var barMsg=bar.querySelector("#aviz-bar-msg");

/* ── Mode management ────────────────────────────────────── */
/* Reflects current mode in the Comment/Browse pill toggle. Called
   from every code path that mutates the mode variable so the pill
   stays in sync regardless of how the change was triggered (toggle
   click, annotation tool, in-page hotkey, etc.). */
function syncModeToggle(){
  var isBrowse=(mode==="browse");
  togglePills.comment.classList.toggle("active",!isBrowse);
  togglePills.browse.classList.toggle("active",isBrowse);
}
/* Pin mode is always armed — box/text are temporary overrides that return to pin. */
function armPinMode(){
  mode="pin";
  document.documentElement.classList.remove("aviz-mode-box","aviz-mode-text","aviz-mode-highlight","aviz-mode-browse");
  document.documentElement.classList.add("aviz-mode-pin");
  activeTool="pin";
  Object.keys(toolBtns).forEach(function(k){toolBtns[k].classList.toggle("active",k==="pin");});
  bar.classList.remove("show");
  removePendingAnnotation();
  if(boxEl){boxEl.remove();boxEl=null;}boxDrawing=false;boxStart=null;
  syncModeToggle();
}
function setMode(m,msg){
  removePendingAnnotation();
  if(boxEl){boxEl.remove();boxEl=null;}boxDrawing=false;boxStart=null;
  mode=m;
  document.documentElement.classList.remove("aviz-mode-pin","aviz-mode-box","aviz-mode-text","aviz-mode-highlight","aviz-mode-browse");
  if(m==="pin")document.documentElement.classList.add("aviz-mode-pin");
  if(m==="box")document.documentElement.classList.add("aviz-mode-box");
  if(m==="text")document.documentElement.classList.add("aviz-mode-text");
  if(m==="highlight")document.documentElement.classList.add("aviz-mode-highlight");
  // browse mode intentionally has no css class with a cursor rule -- the
  // host page's native cursors come back and clicks don't drop pins
  // (pin-mode bails on mode !== "pin"). Hover box also bails on mousemove
  // below. Switching back is done from the Comment pill in the toggle
  // above the toolbar, or implicitly by clicking any annotation tool.
  if(m==="browse")document.documentElement.classList.add("aviz-mode-browse");
  if(msg){barMsg.textContent=msg;bar.classList.add("show");}else{bar.classList.remove("show");}
  syncModeToggle();
}
function exitMode(){armPinMode();}
function setActiveTool(id){
  activeTool=id||"pin";
  Object.keys(toolBtns).forEach(function(k){toolBtns[k].classList.toggle("active",k===activeTool);});
}
bar.querySelector("#aviz-bar-cancel").addEventListener("click",function(){armPinMode();});

/* ── Toolbar click handlers ─────────────────────────────── */
toolBtns.pin.addEventListener("click",function(){closePanel();armPinMode();});
toolBtns.box.addEventListener("click",function(){
  if(mode==="box"){armPinMode();return;}
  closePanel();setActiveTool("box");setMode("box","");
});
toolBtns.text.addEventListener("click",function(){
  if(mode==="text"){armPinMode();return;}
  closePanel();setActiveTool("text");setMode("text","");
});
toolBtns.video.addEventListener("click",function(){
  closePanel();
  if(!guestName){
    if(typeof showOnboard==="function"){showOnboard(function(){openVideoRecorder();});}
    return;
  }
  openVideoRecorder();
});
toolBtns.comments.addEventListener("click",function(){
  if(panelOpen){closePanel();}else{openPanel();}
});
toolBtns.questions.addEventListener("click",function(){/* soon */});

/* ── Mode toggle handlers ─────────────────────────────────
   Comment: arm pin (re-enables annotation tools).
   Browse:  suppress pin drops + hover ring so the reviewer can use
            the host site normally. No top bar message -- the pill
            staying lit already communicates the active mode. */
togglePills.comment.addEventListener("click",function(){
  if(mode!=="browse")return;
  closePanel();armPinMode();
});
togglePills.browse.addEventListener("click",function(){
  if(mode==="browse")return;
  closePanel();setActiveTool(null);setMode("browse","");
});

/* ── Element hover highlight ──────────────────────────────
   A single floating overlay tracks the hovered element via transform —
   transitions on transform/width/height ease between targets, which
   reads as a smooth markup.io-style sweep instead of an instant snap. */
var hoverBox=document.createElement("div");hoverBox.id="aviz-hover-box";document.body.appendChild(hoverBox);
var hlTags=["P","H1","H2","H3","H4","H5","H6","SPAN","A","BUTTON","IMG","TD","TH","LI","SECTION","DIV","HEADER","FOOTER","NAV","MAIN","ARTICLE"];
function hideHoverBox(){hoverBox.classList.remove("show");highlightEl=null;}
document.addEventListener("mousemove",function(e){
  /* Browse mode — no hover ring, no anything. Reviewer wants to use the
     site normally. */
  if(mode==="browse"){hideHoverBox();return;}
  /* While a comment form is open we want full attention on the form, so
     don't shadow the page with the hover overlay. */
  if(pendingAnnotation){hideHoverBox();return;}
  var t=e.target;
  if(t.closest("#aviz-root")||t.closest("#aviz-onboard")||t.closest("#aviz-tour-backdrop")||t.closest(".aviz-tour-callout")||t.closest(".aviz-pin")||t.closest(".aviz-box")||t.closest(".aviz-text-ann")||t.closest(".aviz-pin-form")||t.closest(".aviz-text-input")){hideHoverBox();return;}

  /* Same element — do nothing */
  if(t===highlightEl)return;

  if(hlTags.indexOf(t.tagName)>-1){
    var r=t.getBoundingClientRect();
    if(r.width>30&&r.height>15){
      highlightEl=t;
      var sx=window.pageXOffset||document.documentElement.scrollLeft;
      var sy=window.pageYOffset||document.documentElement.scrollTop;
      hoverBox.style.transform="translate3d("+(r.left+sx)+"px,"+(r.top+sy)+"px,0)";
      hoverBox.style.width=r.width+"px";
      hoverBox.style.height=r.height+"px";
      hoverBox.classList.add("show");
      return;
    }
  }
  hideHoverBox();
});
document.addEventListener("mouseleave",hideHoverBox);
document.addEventListener("scroll",hideHoverBox,{passive:true});
`;
}