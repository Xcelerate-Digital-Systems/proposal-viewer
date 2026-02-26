// app/api/review-widget/[token]/script/parts/core.ts

export function coreJS(c: { token: string; itemId: string; apiBase: string }): string {
  return `
/* ── Config & State ─────────────────────────────────────── */
var C={
  token:"${c.token}",
  item:"${c.itemId}",
  api:"${c.apiBase}/api/review-widget/${c.token}/comments",
  ssApi:"${c.apiBase}/api/review-widget/${c.token}/screenshot",
  accent:"#017C87"
};

var SK="aviz_guest";
var comments=[];
var annotations=[];
var mode="idle";
var panelOpen=false;
var activeTool=null;
var pendingAnnotation=null;
var highlightEl=null;
var guestName="";
var loading=true;
var pollTimer=null;
var boxStart=null;var boxEl=null;var boxDrawing=false;

try{var g=JSON.parse(localStorage.getItem(SK)||"{}");guestName=g.name||"";}catch(e){}
function saveGuest(){try{localStorage.setItem(SK,JSON.stringify({name:guestName}));}catch(e){}}
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
  api("?item="+C.item).then(function(d){comments=d.comments||[];loading=false;if(cb)cb();}).catch(function(){loading=false;if(cb)cb();});
}
function postComment(body,cb){
  body.review_item_id=C.item;
  api("",{method:"POST",body:JSON.stringify(body)}).then(function(d){if(d&&d.id)comments.push(d);if(cb)cb(d);}).catch(function(){if(cb)cb(null);});
}
function uploadScreenshot(dataUrl,cb){
  fetch(C.ssApi,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({item:C.item,image:dataUrl})})
    .then(function(r){return r.json();}).then(function(d){cb(d.url||null);}).catch(function(){cb(null);});
}

/* ── html2canvas loader ─────────────────────────────────── */
function loadH2C(cb){
  if(window.html2canvas){cb();return;}
  var s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
  s.onload=cb;s.onerror=function(){alert("Failed to load screenshot library.");};
  document.head.appendChild(s);
}

/* ── Auto-screenshot (hides widget UI, captures viewport) ── */
function captureAutoScreenshot(cb){
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
      cb(canvas.toDataURL("image/png"));
    }).catch(function(err){
      root.style.display="";if(form)form.style.display="";
      console.error("Auto-screenshot failed:",err);cb(null);
    });
  });
}
`;
}