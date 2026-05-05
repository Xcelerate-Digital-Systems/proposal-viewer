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
function uploadScreenshot(dataUrl,cb,opts){
  var body={item:C.item,image:dataUrl};
  if(opts&&opts.install)body.install=true;
  fetch(C.ssApi,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
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

/* ── Auto-screenshot (hides widget UI but keeps pin marker, crops around pin) ──
   opts.cropAround = { x, y } — page coordinates to centre the 16:9 crop on.
   When omitted, returns the full viewport capture unchanged. */
function captureAutoScreenshot(cb,opts){
  root.style.display="none";
  var form=document.querySelector(".aviz-pin-form");if(form)form.style.display="none";
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
      root.style.display="";if(form)form.style.display="";
      var out=canvas;
      if(opts&&opts.cropAround){
        try{
          /* Pin coords are in PAGE space; canvas captured the viewport at
             scrollX/scrollY, so subtract scroll to get canvas-local px. */
          var pinX=opts.cropAround.x-window.scrollX;
          var pinY=opts.cropAround.y-window.scrollY;
          var dw=Math.min(canvas.width,1280);
          var dh=Math.min(canvas.height,Math.round(dw*9/16));
          if(dw>20&&dh>20){
            var sx=Math.max(0,Math.min(canvas.width-dw,Math.round(pinX-dw/2)));
            var sy=Math.max(0,Math.min(canvas.height-dh,Math.round(pinY-dh/2)));
            var dest=document.createElement("canvas");dest.width=dw;dest.height=dh;
            var ctx=dest.getContext("2d");
            ctx.drawImage(canvas,sx,sy,dw,dh,0,0,dw,dh);
            out=dest;
          }
        }catch(e){/* fall back to full canvas */}
      }
      cb(out.toDataURL("image/jpeg",0.85));
    }).catch(function(err){
      root.style.display="";if(form)form.style.display="";
      console.error("Auto-screenshot failed:",err);cb(null);
    });
  });
}

/* ── Install screenshot — captures the above-the-fold area at the current
      scroll position as a JPEG (smaller than PNG for a full webpage). */
function captureInstallScreenshot(cb){
  root.style.display="none";
  var onboard=document.getElementById("aviz-onboard");if(onboard)onboard.style.display="none";
  loadH2C(function(){
    var prevScroll={x:window.scrollX,y:window.scrollY};
    window.scrollTo(0,0);
    /* Give layout a tick to settle before capturing. */
    setTimeout(function(){
      html2canvas(document.body,{
        useCORS:true,allowTaint:true,
        windowWidth:document.documentElement.clientWidth,
        windowHeight:document.documentElement.clientHeight,
        width:document.documentElement.clientWidth,
        height:document.documentElement.clientHeight,
        x:0,y:0,scrollX:0,scrollY:0
      }).then(function(canvas){
        root.style.display="";if(onboard)onboard.style.display="";
        window.scrollTo(prevScroll.x,prevScroll.y);
        cb(canvas.toDataURL("image/jpeg",0.82));
      }).catch(function(err){
        root.style.display="";if(onboard)onboard.style.display="";
        window.scrollTo(prevScroll.x,prevScroll.y);
        console.error("Install screenshot failed:",err);cb(null);
      });
    },120);
  });
}
`;
}