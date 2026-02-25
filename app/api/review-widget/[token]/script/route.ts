// app/api/review-widget/[token]/script/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const itemId = req.nextUrl.searchParams.get('item');
  if (!itemId) {
    return new NextResponse('/* AgencyViz: missing item param */', {
      status: 200,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    });
  }

  // Validate project
  const { data: project } = await supabaseAdmin
    .from('review_projects')
    .select('id, company_id, title, status')
    .eq('share_token', params.token)
    .single();

  if (!project || project.status === 'archived') {
    return new NextResponse('/* AgencyViz: invalid or archived project */', {
      status: 200,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    });
  }

  // Validate item belongs to project
  const { data: item } = await supabaseAdmin
    .from('review_items')
    .select('id, title, url, type')
    .eq('id', itemId)
    .eq('review_project_id', project.id)
    .eq('type', 'webpage')
    .single();

  if (!item) {
    return new NextResponse('/* AgencyViz: invalid item */', {
      status: 200,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    });
  }

  // Fetch company branding
  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('name, logo_url, accent_color')
    .eq('id', project.company_id)
    .single();

  const accent = company?.accent_color || '#ff6700';
  const companyName = company?.name || 'Feedback';
  const apiBase = process.env.NEXT_PUBLIC_APP_URL || 'https://app.agencyviz.com';

  const js = buildWidgetScript({
    token: params.token,
    itemId: item.id,
    apiBase,
    accent,
    companyName,
  });

  return new NextResponse(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/* ================================================================== */
/*  Widget script builder                                              */
/* ================================================================== */
function buildWidgetScript(c: {
  token: string;
  itemId: string;
  apiBase: string;
  accent: string;
  companyName: string;
}) {
  // We use simple string concat — keeps the output readable and avoids template issues
  return `(function(){
"use strict";
if(window.__aviz_widget)return;
window.__aviz_widget=true;

var C={
  token:"${c.token}",
  item:"${c.itemId}",
  api:"${c.apiBase}/api/review-widget/${c.token}/comments",
  accent:"${c.accent}",
  name:${JSON.stringify(c.companyName)}
};

var SK="aviz_guest";
var comments=[];
var pins=[];
var mode="idle";
var panelOpen=false;
var pendingPin=null;
var highlightEl=null;
var guestName="";

try{var g=JSON.parse(localStorage.getItem(SK)||"{}");guestName=g.name||"";}catch(e){}
function saveGuest(){try{localStorage.setItem(SK,JSON.stringify({name:guestName}));}catch(e){}}

function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML;}
function ago(d){var m=Math.floor((Date.now()-new Date(d).getTime())/60000);if(m<1)return"just now";if(m<60)return m+"m ago";var h=Math.floor(m/60);if(h<24)return h+"h ago";return Math.floor(h/24)+"d ago";}

function api(path,opts){return fetch(C.api+path,opts).then(function(r){return r.json();});}

function loadComments(cb){
  api("?item="+C.item).then(function(d){comments=d.comments||[];if(cb)cb();}).catch(function(){});
}

function postComment(body,cb){
  body.review_item_id=C.item;
  api("",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
    .then(function(d){comments.push(d);if(cb)cb(d);}).catch(function(){});
}

/* ── Styles ─────────────────────────────────────────────── */
var sty=document.createElement("style");
sty.textContent=\`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
#aviz-root,#aviz-root *{box-sizing:border-box;margin:0;padding:0;font-family:'Inter',-apple-system,sans-serif;}
#aviz-fab{position:fixed;bottom:24px;right:24px;z-index:2147483640;width:52px;height:52px;border-radius:50%;
  background:\${C.accent};color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
  box-shadow:0 4px 20px rgba(0,0,0,.2);transition:transform .2s,box-shadow .2s;}
#aviz-fab:hover{transform:scale(1.08);}
#aviz-fab.active{background:#222;}
#aviz-fab svg{width:22px;height:22px;}
#aviz-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;
  background:#ef4444;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;
  justify-content:center;padding:0 4px;border:2px solid #fff;}
#aviz-badge:empty{display:none;}

.aviz-comment-mode,.aviz-comment-mode *{cursor:crosshair!important;}
.aviz-el-hl{outline:2px solid \${C.accent}!important;outline-offset:2px;}

.aviz-pin{position:absolute;z-index:2147483630;width:28px;height:28px;border-radius:50%;
  background:\${C.accent};color:#fff;display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:700;border:2px solid #fff;cursor:pointer;
  box-shadow:0 2px 8px rgba(0,0,0,.2);transition:transform .15s;margin-left:-14px;margin-top:-14px;}
.aviz-pin:hover{transform:scale(1.15);z-index:2147483631;}
.aviz-pin.resolved{background:#9ca3af;opacity:.55;}
.aviz-pin.pending{animation:aviz-pulse 1.2s infinite;}
@keyframes aviz-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}

#aviz-bar{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483642;
  padding:10px 20px;border-radius:12px;background:#111;color:#fff;font-size:13px;font-weight:500;
  box-shadow:0 4px 20px rgba(0,0,0,.3);display:none;align-items:center;gap:12px;}
#aviz-bar.show{display:flex;}
#aviz-bar button{background:rgba(255,255,255,.15);color:#fff;border:none;padding:6px 14px;
  border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;}
#aviz-bar button:hover{background:rgba(255,255,255,.25);}

#aviz-panel{position:fixed;bottom:88px;right:24px;z-index:2147483641;width:340px;
  max-height:calc(100vh - 140px);background:#fff;border-radius:14px;
  box-shadow:0 12px 48px rgba(0,0,0,.15);display:flex;flex-direction:column;overflow:hidden;
  opacity:0;transform:translateY(10px) scale(.97);transition:opacity .2s,transform .2s;pointer-events:none;}
#aviz-panel.open{opacity:1;transform:translateY(0) scale(1);pointer-events:all;}

.aviz-ph{padding:14px 18px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between;}
.aviz-ph h3{font-size:13px;font-weight:600;color:#111;}
.aviz-ph .cnt{font-size:11px;color:#999;margin-left:4px;}
.aviz-pb{flex:1;overflow-y:auto;padding:10px 14px;}
.aviz-pf{padding:10px 14px;border-top:1px solid #f0f0f0;}

.aviz-thr{padding:10px;border-radius:8px;background:#f9fafb;margin-bottom:6px;}
.aviz-thr-pin{display:inline-flex;width:18px;height:18px;border-radius:50%;background:\${C.accent};
  color:#fff;font-size:9px;font-weight:700;align-items:center;justify-content:center;margin-right:4px;vertical-align:middle;}
.aviz-thr-auth{font-size:11px;font-weight:600;color:#111;}
.aviz-thr-badge{display:inline-block;font-size:8px;font-weight:700;text-transform:uppercase;
  padding:1px 5px;border-radius:3px;margin-left:4px;vertical-align:middle;}
.aviz-thr-badge.team{background:\${C.accent}18;color:\${C.accent};}
.aviz-thr-time{font-size:10px;color:#bbb;margin-left:4px;}
.aviz-thr-txt{font-size:12px;color:#555;margin-top:3px;line-height:1.5;white-space:pre-wrap;}
.aviz-reply-btn{font-size:10px;color:#999;background:none;border:none;cursor:pointer;margin-top:4px;padding:0;}
.aviz-reply-btn:hover{color:#555;}

.aviz-inp{width:100%;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;
  color:#111;outline:none;transition:border-color .15s;}
.aviz-inp:focus{border-color:\${C.accent};}
.aviz-inp::placeholder{color:#ccc;}
.aviz-ta{width:100%;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;
  color:#111;outline:none;resize:vertical;min-height:56px;}
.aviz-ta:focus{border-color:\${C.accent};}
.aviz-btn{padding:7px 14px;border-radius:8px;font-size:11px;font-weight:600;border:none;cursor:pointer;}
.aviz-btn:disabled{opacity:.4;cursor:not-allowed;}
.aviz-btn-p{background:\${C.accent};color:#fff;}
.aviz-btn-p:hover:not(:disabled){opacity:.9;}
.aviz-btn-g{background:transparent;color:#999;}
.aviz-empty{text-align:center;padding:28px 14px;color:#bbb;font-size:12px;}

.aviz-pf-row{display:flex;gap:6px;margin-top:6px;}

.aviz-pin-form{position:absolute;z-index:2147483635;width:260px;background:#fff;border-radius:12px;
  box-shadow:0 8px 32px rgba(0,0,0,.15);padding:14px;}
.aviz-pin-form h4{font-size:11px;font-weight:600;color:\${C.accent};text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;}
\`;
document.head.appendChild(sty);

/* ── DOM ────────────────────────────────────────────────── */
var root=document.createElement("div");root.id="aviz-root";document.body.appendChild(root);

var fab=document.createElement("button");fab.id="aviz-fab";
fab.title="Leave feedback";
fab.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>';
var badge=document.createElement("span");badge.id="aviz-badge";fab.appendChild(badge);
root.appendChild(fab);

var bar=document.createElement("div");bar.id="aviz-bar";
bar.innerHTML='<span>Click anywhere to place a pin</span><button id="aviz-bar-cancel">Cancel</button>';
root.appendChild(bar);

/* ── Panel HTML ─────────────────────────────────────────── */
var panel=document.createElement("div");panel.id="aviz-panel";
panel.innerHTML='<div class="aviz-ph"><h3>'+esc(C.name)+' <span class="cnt" id="aviz-cnt"></span></h3>'
  +'<button class="aviz-btn aviz-btn-g" id="aviz-close" style="font-size:16px">&times;</button></div>'
  +'<div class="aviz-pb" id="aviz-body"></div>'
  +'<div class="aviz-pf" id="aviz-footer">'
  +'<input class="aviz-inp" id="aviz-name" placeholder="Your name" style="margin-bottom:6px"/>'
  +'<textarea class="aviz-ta" id="aviz-text" placeholder="Leave a comment\\u2026"></textarea>'
  +'<div class="aviz-pf-row" style="justify-content:flex-end">'
  +'<button class="aviz-btn aviz-btn-p" id="aviz-send" disabled>Post</button>'
  +'</div></div>';
root.appendChild(panel);

var nameInp=panel.querySelector("#aviz-name");
var textInp=panel.querySelector("#aviz-text");
var sendBtn=panel.querySelector("#aviz-send");
var bodyEl=panel.querySelector("#aviz-body");
var cntEl=panel.querySelector("#aviz-cnt");

if(guestName)nameInp.value=guestName;

nameInp.addEventListener("input",function(){guestName=nameInp.value;saveGuest();updateSendState();});
textInp.addEventListener("input",function(){updateSendState();});
function updateSendState(){sendBtn.disabled=!guestName.trim()||!textInp.value.trim();}

/* ── Render ─────────────────────────────────────────────── */
function renderPins(){
  pins.forEach(function(p){p.el.remove();});
  pins=[];
  comments.forEach(function(c){
    if(c.comment_type!=="pin"||c.pin_x==null||c.pin_y==null||c.parent_comment_id)return;
    var el=document.createElement("div");
    el.className="aviz-pin"+(c.resolved?" resolved":"");
    el.style.left=c.pin_x+"px";el.style.top=c.pin_y+"px";
    el.textContent=c.thread_number||"";
    el.addEventListener("click",function(e){e.stopPropagation();openPanel();scrollToThread(c.id);});
    document.body.appendChild(el);
    pins.push({id:c.id,el:el});
  });
}

function renderThreads(){
  var top=comments.filter(function(c){return !c.parent_comment_id;});
  var unresolved=top.filter(function(c){return !c.resolved;});
  var resolved=top.filter(function(c){return c.resolved;});
  cntEl.textContent=unresolved.length?"("+unresolved.length+" open)":"";
  badge.textContent=unresolved.length?unresolved.length:"";

  var html="";
  if(top.length===0){html='<div class="aviz-empty">No comments yet.<br/>Click the page to place a pin.</div>';}
  else{
    unresolved.forEach(function(c){html+=threadHTML(c);});
    if(resolved.length){
      html+='<div style="margin-top:8px;font-size:10px;color:#aaa;font-weight:600;text-transform:uppercase;letter-spacing:.5px;cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\\'none\\'?\\'block\\':\\'none\\'">Resolved ('+resolved.length+')</div>';
      html+='<div style="display:none;opacity:.6">';
      resolved.forEach(function(c){html+=threadHTML(c);});
      html+='</div>';
    }
  }
  bodyEl.innerHTML=html;
}

function threadHTML(c){
  var replies=comments.filter(function(r){return r.parent_comment_id===c.id;});
  var h='<div class="aviz-thr" id="aviz-t-'+c.id+'">';
  if(c.comment_type==="pin"&&c.thread_number)h+='<span class="aviz-thr-pin">'+c.thread_number+'</span>';
  h+='<span class="aviz-thr-auth">'+esc(c.author_name)+'</span>';
  var bt=c.author_type==="team"?"team":"client";
  h+='<span class="aviz-thr-badge '+bt+'">'+bt+'</span>';
  h+='<span class="aviz-thr-time">'+ago(c.created_at)+'</span>';
  h+='<div class="aviz-thr-txt">'+esc(c.content)+'</div>';
  replies.forEach(function(r){
    h+='<div style="margin:6px 0 0 16px;padding-left:10px;border-left:2px solid #e5e7eb">';
    h+='<span class="aviz-thr-auth" style="font-size:10px">'+esc(r.author_name)+'</span>';
    h+='<span class="aviz-thr-time">'+ago(r.created_at)+'</span>';
    h+='<div class="aviz-thr-txt" style="font-size:11px">'+esc(r.content)+'</div></div>';
  });
  h+='<button class="aviz-reply-btn" data-id="'+c.id+'">Reply</button>';
  h+='</div>';
  return h;
}

function scrollToThread(id){
  var el=bodyEl.querySelector("#aviz-t-"+id);
  if(el)el.scrollIntoView({behavior:"smooth",block:"center"});
}

function refresh(){renderPins();renderThreads();}

/* ── Interactions ───────────────────────────────────────── */
fab.addEventListener("click",function(){
  if(panelOpen){closePanel();}
  else{openPanel();}
});

function openPanel(){
  panelOpen=true;panel.classList.add("open");fab.classList.add("active");
  fab.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
  badge.textContent="";fab.appendChild(badge);
}

function closePanel(){
  panelOpen=false;panel.classList.remove("open");fab.classList.remove("active");
  fab.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>';
  fab.appendChild(badge);exitCommentMode();renderThreads();
}

panel.querySelector("#aviz-close").addEventListener("click",closePanel);

// Comment mode
function enterCommentMode(){
  mode="comment";document.documentElement.classList.add("aviz-comment-mode");bar.classList.add("show");
}
function exitCommentMode(){
  mode="idle";document.documentElement.classList.remove("aviz-comment-mode");bar.classList.remove("show");
  if(highlightEl){highlightEl.classList.remove("aviz-el-hl");highlightEl=null;}
  removePendingForm();
}
bar.querySelector("#aviz-bar-cancel").addEventListener("click",exitCommentMode);

// Click to place pin
document.addEventListener("click",function(e){
  if(mode!=="comment")return;
  var t=e.target;
  if(t.closest("#aviz-root")||t.closest(".aviz-pin")||t.closest(".aviz-pin-form"))return;
  e.preventDefault();e.stopPropagation();

  var sx=window.pageXOffset||document.documentElement.scrollLeft;
  var sy=window.pageYOffset||document.documentElement.scrollTop;
  var px=e.clientX+sx;
  var py=e.clientY+sy;

  exitCommentMode();showPendingForm(px,py);
},true);

// Hover highlight
document.addEventListener("mousemove",function(e){
  if(mode!=="comment")return;
  var t=e.target;
  if(t.closest("#aviz-root")||t.closest(".aviz-pin"))return;
  if(highlightEl)highlightEl.classList.remove("aviz-el-hl");
  var tags=["P","H1","H2","H3","H4","H5","H6","SPAN","A","BUTTON","IMG","TD","TH","LI","SECTION","DIV"];
  if(tags.indexOf(t.tagName)>-1){var r=t.getBoundingClientRect();if(r.width>30&&r.height>15){t.classList.add("aviz-el-hl");highlightEl=t;return;}}
  highlightEl=null;
});

/* ── Pending pin form ──────────────────────────────────── */
var pendingForm=null;
function showPendingForm(px,py){
  removePendingForm();
  // Show pending pin
  var pp=document.createElement("div");pp.className="aviz-pin pending";
  pp.style.left=px+"px";pp.style.top=py+"px";pp.textContent="+";
  document.body.appendChild(pp);

  var f=document.createElement("div");f.className="aviz-pin-form";
  f.style.left=(px+20)+"px";f.style.top=(py-10)+"px";
  f.innerHTML='<h4>Pin Comment</h4>'
    +(guestName?'':'<input class="aviz-inp" id="aviz-pf-name" placeholder="Your name" style="margin-bottom:6px"/>')
    +'<textarea class="aviz-ta" id="aviz-pf-text" placeholder="Describe your feedback\\u2026" style="min-height:48px"></textarea>'
    +'<div style="display:flex;gap:6px;margin-top:8px;justify-content:flex-end">'
    +'<button class="aviz-btn aviz-btn-g" id="aviz-pf-cancel">Cancel</button>'
    +'<button class="aviz-btn aviz-btn-p" id="aviz-pf-send">Post</button></div>';
  document.body.appendChild(f);
  pendingForm={el:f,pin:pp,x:px,y:py};

  var pfName=f.querySelector("#aviz-pf-name");
  var pfText=f.querySelector("#aviz-pf-text");
  var pfSend=f.querySelector("#aviz-pf-send");
  pfText.focus();

  pfSend.addEventListener("click",function(){
    var n=pfName?pfName.value.trim():guestName;
    var t=pfText.value.trim();
    if(!n||!t)return;
    guestName=n;saveGuest();if(nameInp)nameInp.value=n;
    pfSend.disabled=true;pfSend.textContent="Posting\\u2026";

    var maxTn=0;comments.forEach(function(c){if(c.thread_number&&c.thread_number>maxTn)maxTn=c.thread_number;});

    postComment({
      author_name:n,
      content:t,
      comment_type:"pin",
      pin_x:px,
      pin_y:py,
      thread_number:maxTn+1,
    },function(){
      removePendingForm();refresh();openPanel();
    });
  });

  f.querySelector("#aviz-pf-cancel").addEventListener("click",removePendingForm);
}

function removePendingForm(){
  if(!pendingForm)return;
  pendingForm.el.remove();pendingForm.pin.remove();pendingForm=null;
}

/* ── General comment from panel ────────────────────────── */
sendBtn.addEventListener("click",function(){
  var t=textInp.value.trim();
  if(!t||!guestName.trim())return;
  sendBtn.disabled=true;sendBtn.textContent="Posting\\u2026";
  postComment({author_name:guestName.trim(),content:t,comment_type:"general"},function(){
    textInp.value="";sendBtn.textContent="Post";updateSendState();refresh();
  });
});

// Reply handling (delegated)
bodyEl.addEventListener("click",function(e){
  var btn=e.target.closest(".aviz-reply-btn");
  if(!btn)return;
  var pid=btn.getAttribute("data-id");
  var existing=btn.parentElement.querySelector(".aviz-reply-form");
  if(existing){existing.remove();return;}
  var rf=document.createElement("div");rf.className="aviz-reply-form";rf.style.marginTop="6px";
  rf.innerHTML='<div style="display:flex;gap:4px"><input class="aviz-inp" placeholder="Reply\\u2026" style="flex:1;font-size:11px;padding:6px 8px"/>'
    +'<button class="aviz-btn aviz-btn-p" style="padding:6px 10px;font-size:10px">Send</button></div>';
  btn.parentElement.appendChild(rf);
  var ri=rf.querySelector("input");var rb=rf.querySelector("button");
  ri.focus();
  rb.addEventListener("click",function(){
    var t=ri.value.trim();if(!t||!guestName)return;
    rb.disabled=true;
    postComment({author_name:guestName,content:t,comment_type:"general",parent_comment_id:pid},function(){
      rf.remove();refresh();
    });
  });
});

/* ── "Add comment" mode trigger ─────────────────────────── */
// Double-click FAB or use panel button
fab.addEventListener("dblclick",function(e){
  e.preventDefault();enterCommentMode();
});

// Add a "Place pin" button in the panel footer
var pinBtn=document.createElement("button");
pinBtn.className="aviz-btn aviz-btn-g";
pinBtn.style.cssText="font-size:11px;margin-right:auto;";
pinBtn.textContent="\\ud83d\\udccc Place Pin";
panel.querySelector(".aviz-pf-row").prepend(pinBtn);
pinBtn.addEventListener("click",function(){enterCommentMode();});

/* ── Init ───────────────────────────────────────────────── */
loadComments(refresh);

// Ping back to verify installation
try{
  var img=new Image();
  img.src=C.api.replace("/comments","/verify")+"?item="+C.item+"&t="+Date.now();
}catch(e){}

})();`;
}