// app/api/review-widget/[token]/script/parts/core.ts

export function coreJS(c: { token: string; apiBase: string }): string {
  return `
/* ── Config & State ─────────────────────────────────────── */
var C={
  token:"${c.token}",
  item:__aviz_resolvedItem,
  api:"${c.apiBase}/api/review-widget/${c.token}/comments",
  ssApi:"${c.apiBase}/api/review-widget/${c.token}/screenshot",
  reactionsApi:"${c.apiBase}/api/review-widget/${c.token}/reactions",
  accent:"#017C87"
};

var SK="review_guest_identity";
var comments=[];
var reactions=[];
var annotations=[];
var mode="idle";
var panelOpen=false;
var activeTool=null;
var pendingAnnotation=null;
var highlightEl=null;
var guestName="";
var guestEmail="";
var loading=true;
var pollTimer=null;
var boxStart=null;var boxEl=null;var boxDrawing=false;

try{var g=JSON.parse(localStorage.getItem(SK)||"{}");guestName=g.name||"";guestEmail=g.email||"";}catch(e){}
function saveGuest(){try{localStorage.setItem(SK,JSON.stringify({name:guestName,email:guestEmail}));}catch(e){}}
function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML;}
function ago(d){var m=Math.floor((Date.now()-new Date(d).getTime())/60000);if(m<1)return"just now";if(m<60)return m+"m ago";var h=Math.floor(m/60);if(h<24)return h+"h ago";return Math.floor(h/24)+"d ago";}

/* ── Coordinate helpers ─────────────────────────────────── */
function docW(){return Math.max(document.documentElement.scrollWidth,document.body.scrollWidth,document.documentElement.clientWidth);}
function docH(){return Math.max(document.documentElement.scrollHeight,document.body.scrollHeight,document.documentElement.clientHeight);}
function pxToPctX(px){return(px/docW())*100;}
function pxToPctY(py){return(py/docH())*100;}
function pctToPxX(p){return(p/100)*docW();}
function pctToPxY(p){return(p/100)*docH();}

/* ── Element anchoring ─────────────────────────────────────
   Document-percentage pin coords drift whenever docH() changes (lazy-loaded
   images, web fonts swapping, dynamic content). Anchoring to the DOM
   element the user actually clicked makes the pin stick to that element
   across layout shifts. We store {selector, ox, oy} in annotation_data and
   recompute the pixel position from getBoundingClientRect() at render. */
function avizEscIdent(s){
  if(window.CSS&&CSS.escape)return CSS.escape(s);
  /* Minimal fallback — escape anything that isn't a-z, 0-9, hyphen, underscore. */
  return String(s).replace(/[^a-zA-Z0-9_-]/g,function(ch){return"\\\\"+ch;});
}
function avizIsWidget(el){
  if(!el||!el.closest)return false;
  return !!(el.closest("#aviz-root")||el.closest("#aviz-onboard")||el.closest("#aviz-tour-backdrop")||el.closest(".aviz-tour-callout")||el.closest(".aviz-pin")||el.closest(".aviz-box")||el.closest(".aviz-text-ann")||el.closest(".aviz-pin-form")||el.closest(".aviz-text-input")||el.closest("#aviz-hover-box")||el.closest("#aviz-panel")||el.closest(".aviz-pin-form")||el.closest("mark.aviz-hl")||el.closest("mark.aviz-hl-pending"));
}
function elementPath(el){
  if(!el||el.nodeType!==1)return null;
  var parts=[];var cur=el;
  while(cur&&cur.nodeType===1&&cur!==document.body&&cur!==document.documentElement){
    /* Prefer a unique id as the path root — short and survives most refactors. */
    if(cur.id){
      try{
        if(document.getElementById(cur.id)===cur){
          parts.unshift("#"+avizEscIdent(cur.id));
          return parts.join(" > ");
        }
      }catch(e){}
    }
    var tag=cur.nodeName.toLowerCase();
    var sib=cur;var nth=1;
    while((sib=sib.previousElementSibling)){if(sib.nodeName===cur.nodeName)nth++;}
    parts.unshift(tag+":nth-of-type("+nth+")");
    cur=cur.parentElement;
  }
  return parts.length?"body > "+parts.join(" > "):null;
}
/* Pick the deepest non-widget element under (clientX, clientY). Falls back
   to e.target. Skips our own UI so a click on the hover overlay anchors to
   the page element it's tracking, not the overlay. */
function pickAnchorElement(clientX,clientY,fallback){
  var stack=document.elementsFromPoint?document.elementsFromPoint(clientX,clientY):[fallback];
  for(var i=0;i<stack.length;i++){
    if(!avizIsWidget(stack[i]))return stack[i];
  }
  return fallback||null;
}
function computeAnchor(el,pageX,pageY){
  if(!el||el===document.body||el===document.documentElement)return null;
  var path=elementPath(el);
  if(!path)return null;
  var r=el.getBoundingClientRect();
  if(r.width<2||r.height<2)return null;
  var sx=window.pageXOffset||document.documentElement.scrollLeft||0;
  var sy=window.pageYOffset||document.documentElement.scrollTop||0;
  var ox=((pageX-(r.left+sx))/r.width)*100;
  var oy=((pageY-(r.top+sy))/r.height)*100;
  /* Clamp so a click slightly outside the element's visible box still anchors. */
  ox=Math.max(0,Math.min(100,ox));
  oy=Math.max(0,Math.min(100,oy));
  return{selector:path,ox:ox,oy:oy};
}
/* Resolve a stored anchor back to page coordinates, or null if the
   element can't be found / has zero size (caller falls back to pin_x/_y). */
function resolveAnchor(anchor){
  if(!anchor||!anchor.selector)return null;
  var el;try{el=document.querySelector(anchor.selector);}catch(e){return null;}
  if(!el)return null;
  var r=el.getBoundingClientRect();
  if(r.width<1||r.height<1)return null;
  var sx=window.pageXOffset||document.documentElement.scrollLeft||0;
  var sy=window.pageYOffset||document.documentElement.scrollTop||0;
  return{x:r.left+sx+r.width*(anchor.ox/100),y:r.top+sy+r.height*(anchor.oy/100)};
}

/* ── API helpers ────────────────────────────────────────── */
function api(path,opts){
  return fetch(C.api+path,Object.assign({},opts||{},{headers:Object.assign({"Content-Type":"application/json"},(opts&&opts.headers)||{})}))
    .then(function(r){return r.json();});
}
function loadComments(cb){
  api("?item="+C.item).then(function(d){comments=d.comments||[];loading=false;loadReactions(cb);}).catch(function(){loading=false;if(cb)cb();});
}
function loadReactions(cb){
  fetch(C.reactionsApi+"?item="+C.item).then(function(r){return r.json();})
    .then(function(d){reactions=d.reactions||[];if(cb)cb();})
    .catch(function(){if(cb)cb();});
}
function toggleReaction(commentId,emoji,cb){
  if(!guestName){if(typeof showOnboard==="function"){showOnboard(function(){toggleReaction(commentId,emoji,cb);});}return;}
  /* Optimistic update */
  var existing=null;
  for(var i=0;i<reactions.length;i++){
    var r=reactions[i];
    if(r.review_comment_id===commentId&&r.emoji===emoji&&r.author_name===guestName){existing=r;break;}
  }
  if(existing){
    reactions=reactions.filter(function(r){return r!==existing;});
  } else {
    reactions.push({id:"tmp-"+Date.now(),review_comment_id:commentId,emoji:emoji,author_name:guestName,author_user_id:null,created_at:new Date().toISOString()});
  }
  if(typeof renderThreads==="function")renderThreads();
  fetch(C.reactionsApi,{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({comment_id:commentId,emoji:emoji,author_name:guestName})})
    .then(function(r){return r.json();}).then(function(){loadReactions(cb);})
    .catch(function(){if(cb)cb();});
}
function postComment(body,cb){
  body.review_item_id=C.item;
  api("",{method:"POST",body:JSON.stringify(body)}).then(function(d){if(d&&d.id)comments.push(d);if(cb)cb(d);}).catch(function(){if(cb)cb(null);});
}
function uploadScreenshot(dataUrl,cb){
  fetch(C.ssApi,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({item:C.item,image:dataUrl})})
    .then(function(r){return r.json();}).then(function(d){cb(d.url||null);}).catch(function(){cb(null);});
}

/* ── Video upload — multipart to /api/review-comments/video-upload ── */
function uploadVideo(blob,cb){
  var form=new FormData();
  form.append("file",blob,"review-"+Date.now()+".webm");
  form.append("share_token",C.token);
  fetch("${c.apiBase}/api/review-comments/video-upload",{method:"POST",body:form})
    .then(function(r){return r.json();})
    .then(function(d){cb(d.url||null);})
    .catch(function(){cb(null);});
}

/* ── html2canvas loader ─────────────────────────────────── */
function loadH2C(cb){
  if(window.html2canvas){cb();return;}
  var s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
  s.onload=cb;s.onerror=function(){alert("Failed to load screenshot library.");};
  document.head.appendChild(s);
}

/* ── Auto-screenshot (captures the current viewport — what's in view) ──
   The pending pin/box marker is appended to <body> directly so it remains
   visible in the capture. We hide only the widget toolbar/panel and the
   open comment form. opts.cropAround is accepted for backwards compatibility
   but is intentionally ignored — cropping at a fixed 16:9 around the pin
   on multi-DPR displays misaligned the crop and often cut the pin out of
   frame. The full viewport is always more useful context for a reviewer. */
function captureAutoScreenshot(cb,opts){
  root.style.display="none";
  var form=document.querySelector(".aviz-pin-form");if(form)form.style.display="none";
  loadH2C(function(){
    /* The caller has just toggled display:none on the form + existing
       annotations and (often) just appended the pending pin marker.
       html2canvas snapshots the current computed DOM, so without waiting a
       paint frame we sometimes capture before the browser has actually
       repainted — the pin is missing or shows in its pre-layout spot.
       Double-rAF guarantees one full paint has completed before we snap. */
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        html2canvas(document.body,{
          useCORS:true,allowTaint:true,
          scale:window.devicePixelRatio||1,
          scrollX:-window.scrollX,scrollY:-window.scrollY,
          windowWidth:document.documentElement.clientWidth,
          windowHeight:document.documentElement.clientHeight,
          width:document.documentElement.clientWidth,
          height:document.documentElement.clientHeight,
          x:window.scrollX,y:window.scrollY
        }).then(function(canvas){
          root.style.display="";if(form)form.style.display="";
          cb(canvas.toDataURL("image/jpeg",0.85));
        }).catch(function(err){
          root.style.display="";if(form)form.style.display="";
          console.error("Auto-screenshot failed:",err);cb(null);
        });
      });
    });
  });
}

`;
}