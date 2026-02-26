// app/api/review-widget/[token]/script/parts/panel.ts

export function panelJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   COMMENTS PANEL  –  Feedbucket-style
   ══════════════════════════════════════════════════════════ */
var panel=document.createElement("div");panel.id="aviz-panel";
panel.innerHTML='<div class="aviz-ph">'
  +'<div class="aviz-ph-left"><span class="aviz-ph-title">Feedback</span>'
  +'<button class="aviz-ph-dots" id="aviz-dots">\\u22EF</button></div>'
  +'<button class="aviz-ph-close" id="aviz-close">'+ICON.close+'</button></div>'
  +'<div class="aviz-tabs">'
  +'<button class="aviz-tab active" data-tab="open">Open <span class="aviz-tab-count" id="aviz-open-cnt">0</span></button>'
  +'<button class="aviz-tab" data-tab="resolved">Resolved <span class="aviz-tab-count" id="aviz-res-cnt">0</span></button>'
  +'</div>'
  +'<div class="aviz-page-label">This page</div>'
  +'<div class="aviz-pb" id="aviz-body"></div>'
  +'<div class="aviz-pf" id="aviz-footer"></div>';
root.appendChild(panel);

var bodyEl=panel.querySelector("#aviz-body");
var footerEl=panel.querySelector("#aviz-footer");
var badgeEl=toolbar.querySelector("#aviz-badge");
var openCntEl=panel.querySelector("#aviz-open-cnt");
var resCntEl=panel.querySelector("#aviz-res-cnt");
var activeTab="open";

/* ── Tabs ──────────────────────────────────────────────── */
panel.querySelectorAll(".aviz-tab").forEach(function(tab){
  tab.addEventListener("click",function(){
    activeTab=tab.getAttribute("data-tab");
    panel.querySelectorAll(".aviz-tab").forEach(function(t){t.classList.remove("active");});
    tab.classList.add("active");
    renderThreads();
  });
});

/* ── Footer: expandable general comment ────────────────── */
var footerExpanded=false;
function renderFooter(){
  if(!footerExpanded){
    footerEl.innerHTML='<button class="aviz-footer-trigger" id="aviz-footer-expand">Add comment\\u2026</button>';
    footerEl.querySelector("#aviz-footer-expand").addEventListener("click",function(){footerExpanded=true;renderFooter();});
  } else {
    footerEl.innerHTML=(guestName?'':'<input class="aviz-inp" id="aviz-name" placeholder="Your name" value="'+esc(guestName)+'"/>')
      +'<textarea class="aviz-ta" id="aviz-text" placeholder="Add comment\\u2026" rows="2"></textarea>'
      +'<div class="aviz-footer-bar">'
      +'<div></div>'
      +'<div class="aviz-footer-right">'
      +'<button class="aviz-cancel-btn" id="aviz-cancel-general">Cancel</button>'
      +'<button class="aviz-post-btn" id="aviz-send" disabled>Comment</button></div></div>';

    var nameInp=footerEl.querySelector("#aviz-name");
    var textInp=footerEl.querySelector("#aviz-text");
    var sendBtn=footerEl.querySelector("#aviz-send");
    textInp.focus();

    function updateSend(){
      var n=nameInp?nameInp.value.trim():guestName;
      sendBtn.disabled=!n||!textInp.value.trim();
    }
    if(nameInp)nameInp.addEventListener("input",function(){guestName=nameInp.value;saveGuest();updateSend();});
    textInp.addEventListener("input",updateSend);

    sendBtn.addEventListener("click",function(){
      var n=nameInp?nameInp.value.trim():guestName;
      var t=textInp.value.trim();if(!n||!t)return;
      guestName=n;saveGuest();
      sendBtn.disabled=true;sendBtn.textContent="Posting\\u2026";
      postComment({author_name:n,content:t,comment_type:"general"},function(){
        footerExpanded=false;renderFooter();refresh();
      });
    });
    textInp.addEventListener("keydown",function(e){if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)){e.preventDefault();sendBtn.click();}});
    footerEl.querySelector("#aviz-cancel-general").addEventListener("click",function(){footerExpanded=false;renderFooter();});
  }
}
renderFooter();

/* ── Panel open/close ──────────────────────────────────── */
function openPanel(){panelOpen=true;panel.classList.add("open");toolbar.classList.add("panel-open");setActiveTool("comments");}
function closePanel(){panelOpen=false;panel.classList.remove("open");toolbar.classList.remove("panel-open");if(activeTool==="comments")setActiveTool(null);}
panel.querySelector("#aviz-close").addEventListener("click",closePanel);

/* ── Thread rendering ──────────────────────────────────── */
function renderThreads(){
  var top=comments.filter(function(c){return !c.parent_comment_id;});
  var unresolved=top.filter(function(c){return !c.resolved;});
  var resolved=top.filter(function(c){return c.resolved;});

  openCntEl.textContent=unresolved.length;
  resCntEl.textContent=resolved.length;
  if(badgeEl)badgeEl.textContent=unresolved.length?unresolved.length:"";

  var list=activeTab==="open"?unresolved:resolved;

  if(loading){bodyEl.innerHTML='<div class="aviz-empty">Loading\\u2026</div>';return;}

  var html="";
  if(list.length===0){
    html='<div class="aviz-empty">'
      +(activeTab==="open"
        ?'<p>No open feedback yet.</p><p class="aviz-empty-sub">Use the tools on the right to leave feedback.</p>'
        :'<p>No resolved feedback.</p>')
      +'</div>';
  } else {
    list.forEach(function(c){html+=threadHTML(c);});
  }
  bodyEl.innerHTML=html;
  bindThreadEvents();
}

function threadHTML(c){
  var replies=comments.filter(function(r){return r.parent_comment_id===c.id;});
  var replyCount=replies.length;

  var h='<div class="aviz-card" id="aviz-t-'+c.id+'" data-id="'+c.id+'">';

  /* Author name + collapse toggle */
  h+='<div class="aviz-card-head">';
  h+='<span class="aviz-card-author">'+esc(c.author_name)+'</span>';
  if(c.author_type==="team")h+='<span class="aviz-card-team">Team</span>';
  h+='</div>';

  /* Content */
  h+='<div class="aviz-card-content">'+esc(c.content)+'</div>';

  /* Replies (if any) */
  if(replyCount>0){
    h+='<div class="aviz-card-replies">';
    replies.forEach(function(r){
      h+='<div class="aviz-card-reply">';
      h+='<span class="aviz-card-reply-author">'+esc(r.author_name)+'</span>';
      if(r.author_type==="team")h+='<span class="aviz-card-team sm">Team</span>';
      h+='<span class="aviz-card-reply-time">'+ago(r.created_at)+'</span>';
      h+='<div class="aviz-card-reply-text">'+esc(r.content)+'</div>';
      h+='</div>';
    });
    h+='</div>';
  }

  /* Screenshot thumbnail + meta */
  if(c.screenshot_url){
    h+='<div class="aviz-card-meta">';
    h+='<img class="aviz-card-thumb" src="'+esc(c.screenshot_url)+'" onclick="event.stopPropagation();window.open(this.src,\\'_blank\\')" />';
    h+='<div class="aviz-card-meta-info">';
    h+='<span class="aviz-card-meta-row">'+ago(c.created_at)+'</span>';
    if(c.comment_type&&c.comment_type!=="general"){
      h+='<span class="aviz-card-meta-row" style="text-transform:capitalize">'+c.comment_type+'</span>';
    }
    h+='</div></div>';
  } else {
    h+='<div class="aviz-card-time">'+ago(c.created_at)+'</div>';
  }

  /* Action bar */
  h+='<div class="aviz-card-bar">';
  h+='<div class="aviz-card-bar-left">';
  h+='<button class="aviz-card-action aviz-reply-toggle" data-id="'+c.id+'">'
    +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
    +' '+replyCount+'</button>';
  h+='</div>';
  h+='<div class="aviz-card-bar-right">';
  if(!c.resolved){
    h+='<button class="aviz-resolve-btn aviz-card-resolve" data-id="'+c.id+'" data-resolved="false">'
      +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
      +' Resolve</button>';
  } else {
    h+='<button class="aviz-resolve-btn aviz-card-reopen" data-id="'+c.id+'" data-resolved="true">'
      +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>'
      +' Reopen</button>';
  }
  h+='</div></div>';

  h+='</div>';
  return h;
}

function bindThreadEvents(){
  /* Resolve / reopen */
  bodyEl.querySelectorAll(".aviz-resolve-btn").forEach(function(btn){
    btn.addEventListener("click",function(e){
      e.stopPropagation();
      var cid=btn.getAttribute("data-id");var cur=btn.getAttribute("data-resolved")==="true";
      btn.disabled=true;
      fetch(C.api+"?item="+C.item+"&comment_id="+cid+"&resolve="+(cur?"false":"true"),{method:"PATCH",headers:{"Content-Type":"application/json"}})
        .then(function(r){return r.json();}).then(function(){
          comments.forEach(function(c){if(c.id===cid)c.resolved=!cur;});refresh();
        }).catch(function(){btn.disabled=false;});
    });
  });

  /* Reply toggle */
  bodyEl.querySelectorAll(".aviz-reply-toggle").forEach(function(btn){
    btn.addEventListener("click",function(e){
      e.stopPropagation();
      var pid=btn.getAttribute("data-id");var card=btn.closest(".aviz-card");
      var existing=card.querySelector(".aviz-reply-form");if(existing){existing.remove();return;}
      var rf=document.createElement("div");rf.className="aviz-reply-form";
      rf.innerHTML=(guestName?'':'<input class="aviz-inp" placeholder="Your name" style="margin-bottom:6px"/>')
        +'<div class="aviz-reply-input-row"><input class="aviz-inp" placeholder="Write a reply\\u2026" style="flex:1"/>'
        +'<button class="aviz-post-btn sm">'
        +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
        +'</button></div>';
      /* Insert before the action bar */
      var bar=card.querySelector(".aviz-card-bar");
      card.insertBefore(rf,bar);
      var rName=rf.querySelector("input[placeholder=\\"Your name\\"]");
      var ri=rf.querySelector("input[placeholder=\\"Write a reply\\u2026\\"]");
      var rb=rf.querySelector("button");(ri||rName).focus();
      rb.addEventListener("click",function(ev){
        ev.stopPropagation();
        var n=rName?rName.value.trim():guestName;var t=ri.value.trim();if(!n||!t)return;
        if(!guestName){guestName=n;saveGuest();}
        rb.disabled=true;
        postComment({author_name:n,content:t,comment_type:"general",parent_comment_id:pid},function(){rf.remove();refresh();});
      });
      ri.addEventListener("keydown",function(ev){if(ev.key==="Enter"&&!ev.shiftKey){ev.preventDefault();rb.click();}});
    });
  });
}

function scrollToThread(id){
  if(!panelOpen)openPanel();
  setTimeout(function(){
    var el=bodyEl.querySelector("#aviz-t-"+id);
    if(el){el.scrollIntoView({behavior:"smooth",block:"center"});el.classList.add("highlight");
      setTimeout(function(){el.classList.remove("highlight");},1500);}
  },100);
}

function refresh(){renderAnnotations();renderThreads();}
`;
}