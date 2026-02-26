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
  +'<div class="aviz-tabs-left">'
  +'<button class="aviz-tab active" data-tab="open">Open <span class="aviz-tab-count" id="aviz-open-cnt">0</span></button>'
  +'<button class="aviz-tab" data-tab="resolved">Resolved <span class="aviz-tab-count" id="aviz-res-cnt">0</span></button>'
  +'</div>'
  +'<button class="aviz-filter-btn" id="aviz-filter">'
  +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>'
  +' Filter</button>'
  +'</div>'
  +'<div class="aviz-page-label">This page</div>'
  +'<div class="aviz-pb" id="aviz-body"></div>'
  +'<div class="aviz-other-pages" id="aviz-other-pages">'
  +'<div class="aviz-other-pages-header" id="aviz-other-pages-toggle">'
  +'<span><span class="aviz-other-pages-label">Other Pages</span>'
  +'<span class="aviz-other-pages-count" id="aviz-other-cnt">0</span></span>'
  +'<svg class="aviz-other-pages-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
  +'</div></div>'
  +'<div class="aviz-pf" id="aviz-footer"></div>';
root.appendChild(panel);

var bodyEl=panel.querySelector("#aviz-body");
var footerEl=panel.querySelector("#aviz-footer");
var badgeEl=toolbar.querySelector("#aviz-badge");
var openCntEl=panel.querySelector("#aviz-open-cnt");
var resCntEl=panel.querySelector("#aviz-res-cnt");
var activeTab="open";
var expandedCardId=null;

/* ── Other Pages toggle ────────────────────────────────── */
panel.querySelector("#aviz-other-pages-toggle").addEventListener("click",function(){
  this.classList.toggle("open");
});

/* ── Tabs ──────────────────────────────────────────────── */
panel.querySelectorAll(".aviz-tab").forEach(function(tab){
  tab.addEventListener("click",function(){
    activeTab=tab.getAttribute("data-tab");
    panel.querySelectorAll(".aviz-tab").forEach(function(t){t.classList.remove("active");});
    tab.classList.add("active");
    expandedCardId=null;
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
    footerEl.innerHTML=(guestName?'':'<input class="aviz-inp" id="aviz-name" placeholder="Your name" value="'+esc(guestName)+'" style="margin-bottom:8px"/>')
      +'<textarea class="aviz-ta" id="aviz-text" placeholder="Add comment\\u2026" rows="2"></textarea>'
      +'<div class="aviz-footer-bar">'
      +'<div class="aviz-footer-left">'
      +'<button class="aviz-footer-icon" title="Attach file"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></button>'
      +'<button class="aviz-footer-icon" title="Mention"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg></button>'
      +'</div>'
      +'<div class="aviz-footer-right">'
      +'<button class="aviz-footer-vis"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Everyone</button>'
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
  var isExpanded=expandedCardId===c.id;

  var h='<div class="aviz-card'+(isExpanded?' expanded':'')+'" id="aviz-t-'+c.id+'" data-id="'+c.id+'">';

  /* Author name */
  h+='<div class="aviz-card-head">';
  h+='<span class="aviz-card-author">'+esc(c.author_name)+'</span>';
  if(c.author_type==="team")h+='<span class="aviz-card-team">Team</span>';
  h+='<div class="aviz-menu-wrap">';
  h+='<button class="aviz-menu-btn" data-menu="'+c.id+'">\\u22EF</button>';
  h+='<div class="aviz-menu" id="aviz-menu-'+c.id+'">';
  h+='<button class="aviz-menu-item aviz-edit-btn" data-id="'+c.id+'" data-kind="comment">Edit</button>';
  h+='<button class="aviz-menu-item aviz-delete-btn danger" data-id="'+c.id+'" data-kind="comment">Delete</button>';
  h+='</div></div>';
  h+='</div>';

  /* Content */
  h+='<div class="aviz-card-content">'+esc(c.content)+'</div>';

  /* ── Collapsed: compact meta row ─────────────────────── */
  h+='<div class="aviz-card-compact-meta">';
  h+='<span class="aviz-card-compact-item">'
    +'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
    +' '+ago(c.created_at)+'</span>';
  h+='<span class="aviz-card-compact-item">'
    +'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
    +' '+replyCount+'</span>';
  h+='</div>';

  /* ── Expanded: full detail ───────────────────────────── */
  h+='<div class="aviz-card-expanded">';

  /* Replies (if any) */
  if(replyCount>0){
    h+='<div class="aviz-card-replies">';
    replies.forEach(function(r){
      h+='<div class="aviz-card-reply">';
      h+='<div class="aviz-card-reply-head">';
      h+='<span class="aviz-card-reply-author">'+esc(r.author_name)+'</span>';
      if(r.author_type==="team")h+='<span class="aviz-card-team sm">Team</span>';
      h+='<span class="aviz-card-reply-time">'+ago(r.created_at)+'</span>';
      h+='<div class="aviz-menu-wrap">';
      h+='<button class="aviz-menu-btn" data-menu="'+r.id+'">\\u22EF</button>';
      h+='<div class="aviz-menu" id="aviz-menu-'+r.id+'">';
      h+='<button class="aviz-menu-item aviz-edit-btn" data-id="'+r.id+'" data-kind="reply">Edit</button>';
      h+='<button class="aviz-menu-item aviz-delete-btn danger" data-id="'+r.id+'" data-kind="reply">Delete</button>';
      h+='</div></div>';
      h+='</div>';
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
    h+='<span class="aviz-card-meta-row">Desktop</span>';
    if(c.page_url){
      h+='<span class="aviz-card-meta-row">'+esc(c.page_url)+'</span>';
    } else {
      h+='<span class="aviz-card-meta-row">'+window.location.href+'</span>';
    }
    h+='</div></div>';
  } else {
    h+='<div class="aviz-card-meta">';
    h+='<div class="aviz-card-meta-info" style="gap:2px">';
    h+='<span class="aviz-card-meta-row">'+ago(c.created_at)+'</span>';
    h+='<span class="aviz-card-meta-row">Desktop</span>';
    h+='<span class="aviz-card-meta-row">'+window.location.href+'</span>';
    h+='</div></div>';
  }

  /* Inline comment input */
  h+='<div class="aviz-card-comment-input">';
  h+='<input class="aviz-card-comment-placeholder aviz-reply-trigger" data-id="'+c.id+'" placeholder="Add comment\\u2026" readonly />';
  h+='</div>';

  /* Action bar: icons left, resolve + comment right */
  h+='<div class="aviz-card-bar">';
  h+='<div class="aviz-card-bar-left">';
  h+='<button class="aviz-footer-icon" title="Attach"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></button>';
  h+='<button class="aviz-footer-icon" title="Mention"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg></button>';
  h+='<button class="aviz-footer-vis"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Everyone</button>';
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
  h+='<button class="aviz-card-comment-btn aviz-reply-trigger" data-id="'+c.id+'" disabled>Comment</button>';
  h+='</div></div>';

  h+='</div>'; /* end expanded */

  h+='</div>';
  return h;
}

function bindThreadEvents(){
  /* Card expand/collapse on click */
  bodyEl.querySelectorAll(".aviz-card").forEach(function(card){
    card.addEventListener("click",function(e){
      if(e.target.closest("button")||e.target.closest("input")||e.target.closest("textarea")||e.target.closest("a")||e.target.closest("img"))return;
      var cid=card.getAttribute("data-id");
      if(expandedCardId===cid){
        expandedCardId=null;
      } else {
        expandedCardId=cid;
      }
      renderThreads();
    });
  });

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

  /* Reply trigger */
  bodyEl.querySelectorAll(".aviz-reply-trigger").forEach(function(el){
    el.addEventListener("click",function(e){
      e.stopPropagation();
      var pid=el.getAttribute("data-id");
      var card=bodyEl.querySelector("#aviz-t-"+pid);
      if(!card)return;
      var inputArea=card.querySelector(".aviz-card-comment-input");
      if(!inputArea)return;
      var existing=inputArea.querySelector(".aviz-card-comment-form");
      if(existing)return;

      inputArea.innerHTML='<div class="aviz-card-comment-form">'
        +(guestName?'':'<input class="aviz-inp" placeholder="Your name" style="margin-bottom:6px"/>')
        +'<textarea class="aviz-ta" placeholder="Add comment\\u2026" rows="2" style="min-height:48px"></textarea>'
        +'</div>';

      var rName=inputArea.querySelector("input[placeholder=\\"Your name\\"]");
      var rText=inputArea.querySelector("textarea");
      var commentBtn=card.querySelector(".aviz-card-comment-btn");
      (rText||rName).focus();

      function updateBtn(){
        var n=rName?rName.value.trim():guestName;
        if(commentBtn)commentBtn.disabled=!n||!rText.value.trim();
      }
      if(rName)rName.addEventListener("input",function(){guestName=rName.value;saveGuest();updateBtn();});
      rText.addEventListener("input",updateBtn);

      if(commentBtn){
        var newBtn=commentBtn.cloneNode(true);
        commentBtn.parentNode.replaceChild(newBtn,commentBtn);
        newBtn.addEventListener("click",function(ev){
          ev.stopPropagation();
          var n=rName?rName.value.trim():guestName;
          var t=rText.value.trim();if(!n||!t)return;
          if(!guestName){guestName=n;saveGuest();}
          newBtn.disabled=true;newBtn.textContent="Posting\\u2026";
          postComment({author_name:n,content:t,comment_type:"general",parent_comment_id:pid},function(){refresh();});
        });
      }

      rText.addEventListener("keydown",function(ev){
        if(ev.key==="Enter"&&(ev.metaKey||ev.ctrlKey)){
          ev.preventDefault();
          var btn=card.querySelector(".aviz-card-comment-btn");
          if(btn)btn.click();
        }
      });
    });
  });

  /* ── ⋯ menus ─────────────────────────────────────────── */
  bodyEl.querySelectorAll(".aviz-menu-btn").forEach(function(btn){
    btn.addEventListener("click",function(e){
      e.stopPropagation();
      var menuId=btn.getAttribute("data-menu");
      var menu=bodyEl.querySelector("#aviz-menu-"+menuId);
      if(!menu)return;
      /* Close all other menus */
      bodyEl.querySelectorAll(".aviz-menu.open").forEach(function(m){if(m!==menu)m.classList.remove("open");});
      menu.classList.toggle("open");
    });
  });

  /* Close menus on outside click */
  document.addEventListener("click",function closeMenus(){
    bodyEl.querySelectorAll(".aviz-menu.open").forEach(function(m){m.classList.remove("open");});
  },{once:true});

  /* ── Edit ─────────────────────────────────────────────── */
  bodyEl.querySelectorAll(".aviz-edit-btn").forEach(function(btn){
    btn.addEventListener("click",function(e){
      e.stopPropagation();
      var cid=btn.getAttribute("data-id");
      var kind=btn.getAttribute("data-kind");
      /* Close the menu */
      var menu=btn.closest(".aviz-menu");if(menu)menu.classList.remove("open");

      var c=comments.find(function(x){return x.id===cid;});
      if(!c)return;

      /* Find the content element */
      var contentEl;
      if(kind==="comment"){
        var card=bodyEl.querySelector("#aviz-t-"+cid);
        if(card)contentEl=card.querySelector(".aviz-card-content");
      } else {
        /* Reply — find by iterating reply elements */
        bodyEl.querySelectorAll(".aviz-card-reply").forEach(function(replyEl){
          var editBtn=replyEl.querySelector('.aviz-edit-btn[data-id="'+cid+'"]');
          if(editBtn)contentEl=replyEl.querySelector(".aviz-card-reply-text");
        });
      }
      if(!contentEl)return;

      var origText=c.content;
      contentEl.innerHTML='<textarea class="aviz-ta aviz-edit-ta" rows="2" style="min-height:48px;width:100%">'+esc(origText)+'</textarea>'
        +'<div style="display:flex;gap:6px;margin-top:6px;justify-content:flex-end">'
        +'<button class="aviz-btn aviz-btn-g aviz-edit-cancel">Cancel</button>'
        +'<button class="aviz-btn aviz-btn-p aviz-edit-save">Save</button></div>';

      var ta=contentEl.querySelector(".aviz-edit-ta");
      var saveBtn=contentEl.querySelector(".aviz-edit-save");
      var cancelBtn=contentEl.querySelector(".aviz-edit-cancel");
      ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);

      cancelBtn.addEventListener("click",function(ev){
        ev.stopPropagation();contentEl.textContent=origText;
      });

      saveBtn.addEventListener("click",function(ev){
        ev.stopPropagation();
        var newText=ta.value.trim();
        if(!newText){return;}
        if(newText===origText){contentEl.textContent=origText;return;}
        saveBtn.disabled=true;saveBtn.textContent="Saving\\u2026";
        fetch(C.api+"?item="+C.item+"&comment_id="+cid,{
          method:"PATCH",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({content:newText})
        }).then(function(r){return r.json();}).then(function(d){
          if(d.error){alert(d.error);contentEl.textContent=origText;return;}
          c.content=newText;
          refresh();
        }).catch(function(){contentEl.textContent=origText;});
      });

      ta.addEventListener("keydown",function(ev){
        if(ev.key==="Enter"&&(ev.metaKey||ev.ctrlKey)){ev.preventDefault();saveBtn.click();}
        if(ev.key==="Escape"){ev.stopPropagation();cancelBtn.click();}
      });
    });
  });

  /* ── Delete ──────────────────────────────────────────── */
  bodyEl.querySelectorAll(".aviz-delete-btn").forEach(function(btn){
    btn.addEventListener("click",function(e){
      e.stopPropagation();
      var cid=btn.getAttribute("data-id");
      var kind=btn.getAttribute("data-kind");
      var menu=btn.closest(".aviz-menu");if(menu)menu.classList.remove("open");

      var msg=kind==="comment"?"Delete this comment and all its replies?":"Delete this reply?";
      if(!confirm(msg))return;

      fetch(C.api+"?item="+C.item+"&comment_id="+cid,{method:"DELETE"})
        .then(function(r){return r.json();}).then(function(d){
          if(d.error){alert(d.error);return;}
          /* Remove from local array */
          if(kind==="comment"){
            comments=comments.filter(function(c){return c.id!==cid&&c.parent_comment_id!==cid;});
          } else {
            comments=comments.filter(function(c){return c.id!==cid;});
          }
          if(expandedCardId===cid)expandedCardId=null;
          refresh();
        }).catch(function(err){alert("Failed to delete");});
    });
  });
}

function scrollToThread(id){
  if(!panelOpen)openPanel();
  expandedCardId=id;
  setTimeout(function(){
    renderThreads();
    setTimeout(function(){
      var el=bodyEl.querySelector("#aviz-t-"+id);
      if(el){el.scrollIntoView({behavior:"smooth",block:"center"});el.classList.add("highlight");
        setTimeout(function(){el.classList.remove("highlight");},1500);}
    },50);
  },100);
}

function refresh(){renderAnnotations();renderThreads();}
`;
}