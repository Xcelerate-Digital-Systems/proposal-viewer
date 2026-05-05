// app/api/review-widget/[token]/script/parts/panel.ts

export function panelJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   COMMENTS PANEL  –  matches in-app CommentsPanel + CommentThread
   ══════════════════════════════════════════════════════════ */
var panel=document.createElement("div");panel.id="aviz-panel";
panel.innerHTML='<div class="aviz-ph">'
  +'<div class="aviz-ph-left"><span class="aviz-ph-title">Comments</span>'
  +'<span class="aviz-ph-sub" id="aviz-ph-sub"></span></div>'
  +'<button class="aviz-ph-close" id="aviz-close" aria-label="Close">'
    +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  +'</button></div>'
  +'<div class="aviz-pb" id="aviz-body"></div>'
  +'<div class="aviz-pf" id="aviz-footer"></div>';
root.appendChild(panel);

var bodyEl=panel.querySelector("#aviz-body");
var footerEl=panel.querySelector("#aviz-footer");
var subEl=panel.querySelector("#aviz-ph-sub");
var badgeEl=toolbar.querySelector("#aviz-badge");
var resolvedExpanded=false;
var replyOpenId=null;     /* which thread has its reply form open */
var editingId=null;       /* which comment is currently being edited */

/* ── SVG helpers ───────────────────────────────────────── */
var SVG={
  send:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  reply:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>',
  resolve:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  reopen:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  empty:'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  chevDown:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  chevRight:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  resolvedTag:'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  smallReopen:'<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  smile:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'
};

var REACTION_EMOJIS=["\\uD83D\\uDC4D","\\u2764\\uFE0F","\\uD83C\\uDF89","\\uD83D\\uDE82","\\uD83D\\uDE02","\\uD83D\\uDE4F","\\uD83D\\uDC40","\\u2705"];

function priorityDef(p){
  if(p==="high")return{label:"High",cls:"p-high"};
  if(p==="medium")return{label:"Medium",cls:"p-medium"};
  if(p==="low")return{label:"Low",cls:"p-low"};
  return null;
}

/* ── Footer: general comment composer ──────────────────── */
var footerExpanded=false;
function renderFooter(){
  if(!footerExpanded){
    footerEl.innerHTML='<button class="aviz-footer-trigger" id="aviz-footer-expand">Leave a general comment\\u2026</button>';
    footerEl.querySelector("#aviz-footer-expand").addEventListener("click",function(){footerExpanded=true;renderFooter();});
    return;
  }
  footerEl.innerHTML='<form class="aviz-footer-form" id="aviz-footer-form">'
    +(guestName?'':'<input class="aviz-footer-name" id="aviz-name" placeholder="Your name" value="'+esc(guestName)+'"/>')
    +'<textarea class="aviz-footer-text" id="aviz-text" placeholder="Your comment\\u2026" rows="2"></textarea>'
    +'<div class="aviz-footer-actions">'
    +'<button type="button" class="aviz-footer-cancel" id="aviz-cancel-general">Cancel</button>'
    +'<button type="submit" class="aviz-footer-post" id="aviz-send" disabled>'+SVG.send+' Post</button>'
    +'</div></form>';

  var form=footerEl.querySelector("#aviz-footer-form");
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

  form.addEventListener("submit",function(e){
    e.preventDefault();
    var n=nameInp?nameInp.value.trim():guestName;
    var t=textInp.value.trim();if(!n||!t)return;
    guestName=n;saveGuest();
    sendBtn.disabled=true;sendBtn.innerHTML=SVG.send+' Posting\\u2026';
    postComment({author_name:n,content:t,comment_type:"general"},function(){
      footerExpanded=false;renderFooter();refresh();
    });
  });
  textInp.addEventListener("keydown",function(e){
    if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)){e.preventDefault();form.dispatchEvent(new Event("submit",{cancelable:true}));}
  });
  footerEl.querySelector("#aviz-cancel-general").addEventListener("click",function(){footerExpanded=false;renderFooter();});
}
renderFooter();

/* ── Panel open/close ──────────────────────────────────── */
function openPanel(){panelOpen=true;panel.classList.add("open");toolbar.classList.add("panel-open");setActiveTool("comments");}
function closePanel(){panelOpen=false;panel.classList.remove("open");toolbar.classList.remove("panel-open");if(activeTool==="comments")setActiveTool(null);}
panel.querySelector("#aviz-close").addEventListener("click",closePanel);

/* ── Render ─────────────────────────────────────────────── */
function renderThreads(){
  var top=comments.filter(function(c){return !c.parent_comment_id;});
  var unresolved=top.filter(function(c){return !c.resolved;});
  var resolved=top.filter(function(c){return c.resolved;});

  if(badgeEl)badgeEl.textContent=unresolved.length?unresolved.length:"";

  if(unresolved.length||resolved.length){
    subEl.textContent=unresolved.length+" open"+(resolved.length?" \\u00B7 "+resolved.length+" resolved":"");
  } else {
    subEl.textContent="";
  }

  if(loading){bodyEl.innerHTML='<div class="aviz-empty"><p>Loading\\u2026</p></div>';return;}

  if(!unresolved.length&&!resolved.length){
    bodyEl.innerHTML='<div class="aviz-empty">'
      +'<div class="aviz-empty-icon">'+SVG.empty+'</div>'
      +'<p>Click anywhere on the content to leave a comment.</p>'
      +'</div>';
    return;
  }

  var html="";
  unresolved.forEach(function(c){html+=threadHTML(c);});
  if(resolved.length){
    html+='<button class="aviz-resolved-toggle" id="aviz-resolved-toggle">'
      +(resolvedExpanded?SVG.chevDown:SVG.chevRight)
      +' Resolved ('+resolved.length+')</button>';
    if(resolvedExpanded){
      html+='<div class="aviz-resolved-list">';
      resolved.forEach(function(c){html+=resolvedHTML(c);});
      html+='</div>';
    }
  }
  bodyEl.innerHTML=html;
  bindThreadEvents();
}

function reactionBarHTML(commentId){
  var rs=reactions.filter(function(r){return r.review_comment_id===commentId;});
  var groups={};var order=[];
  rs.forEach(function(r){
    if(!groups[r.emoji]){groups[r.emoji]={count:0,mine:false,names:[]};order.push(r.emoji);}
    groups[r.emoji].count++;
    if(r.author_name===guestName)groups[r.emoji].mine=true;
    groups[r.emoji].names.push(r.author_name);
  });
  var h='<div class="aviz-rxn-bar" data-id="'+commentId+'">';
  order.forEach(function(emoji){
    var g=groups[emoji];
    h+='<button class="aviz-rxn'+(g.mine?' mine':'')+'" data-emoji="'+esc(emoji)+'" title="'+esc(g.names.join(", "))+'">'
      +'<span class="aviz-rxn-emoji">'+esc(emoji)+'</span>'
      +'<span>'+g.count+'</span></button>';
  });
  h+='<button class="aviz-rxn-add" title="Add reaction">'+SVG.smile+'</button>';
  h+='</div>';
  return h;
}

function avatarFor(name,isTeam){
  var initial=esc((name||"?").charAt(0).toUpperCase());
  return '<div class="aviz-avatar'+(isTeam?'':' guest')+'">'+initial+'</div>';
}
function replyAvatarFor(name,isTeam){
  var initial=esc((name||"?").charAt(0).toUpperCase());
  return '<div class="aviz-card-reply-avatar'+(isTeam?'':' guest')+'">'+initial+'</div>';
}

function threadHTML(c){
  var replies=comments.filter(function(r){return r.parent_comment_id===c.id;});
  var isTeam=c.author_type==="team";
  var pri=priorityDef(c.priority);
  var isEditing=editingId===c.id;
  var isReplying=replyOpenId===c.id;

  var h='<div class="aviz-card" id="aviz-t-'+c.id+'" data-id="'+c.id+'">';

  /* Pin badge row */
  if(c.comment_type==="pin"&&c.thread_number){
    h+='<div class="aviz-card-pinbadge">'
      +'<span class="aviz-card-pinbadge-num">'+c.thread_number+'</span>'
      +'<span class="aviz-card-pinbadge-label">Pinned to content</span>'
      +'</div>';
  }

  /* Author row */
  h+='<div class="aviz-card-row">';
  h+=avatarFor(c.author_name,isTeam);
  h+='<div class="aviz-card-main">';
  h+='<div class="aviz-card-meta-row">';
  h+='<span class="aviz-card-author">'+esc(c.author_name)+'</span>';
  if(isTeam)h+='<span class="aviz-card-team">Team</span>';
  if(pri)h+='<span class="aviz-card-priority '+pri.cls+'">'+pri.label+' priority</span>';
  h+='<span class="aviz-card-time">'+ago(c.created_at)+'</span>';
  h+='</div>';

  /* Highlight quote */
  if(c.comment_type==="text_highlight"&&c.highlight_text){
    h+='<div class="aviz-card-quote"><p>\\u201C'+esc(c.highlight_text)+'\\u201D</p></div>';
  }

  /* Content / edit */
  if(isEditing){
    h+='<div class="aviz-card-edit">'
      +'<textarea class="aviz-card-edit-ta" rows="2">'+esc(c.content)+'</textarea>'
      +'<div class="aviz-card-edit-bar">'
      +'<button class="aviz-card-edit-save" data-id="'+c.id+'">Save</button>'
      +'<button class="aviz-card-edit-cancel" data-id="'+c.id+'">Cancel</button>'
      +'</div></div>';
  } else {
    h+='<div class="aviz-card-content">'+esc(c.content)+'</div>';
  }

  /* Inline video */
  if(c.video_url){
    h+='<video class="aviz-card-video" src="'+esc(c.video_url)+'" controls preload="metadata"></video>';
  }

  /* Screenshot meta */
  if(c.screenshot_url){
    h+='<div class="aviz-card-screenshot">';
    h+='<img class="aviz-card-thumb" src="'+esc(c.screenshot_url)+'" data-src="'+esc(c.screenshot_url)+'" />';
    h+='<div class="aviz-card-screenshot-info">';
    if(c.page_url)h+='<span class="aviz-card-screenshot-row">'+esc(c.page_url)+'</span>';
    h+='<span class="aviz-card-screenshot-row">Desktop</span>';
    h+='</div></div>';
  }

  /* Reactions */
  h+=reactionBarHTML(c.id);

  h+='</div></div>'; /* close card-main + card-row */

  /* Replies */
  if(replies.length){
    h+='<div class="aviz-card-replies">';
    replies.forEach(function(r){
      var rTeam=r.author_type==="team";
      h+='<div class="aviz-card-reply" data-id="'+r.id+'">';
      h+='<div class="aviz-card-reply-row">';
      h+=replyAvatarFor(r.author_name,rTeam);
      h+='<div class="aviz-card-reply-main">';
      h+='<div class="aviz-card-reply-meta">';
      h+='<span class="aviz-card-reply-author">'+esc(r.author_name)+'</span>';
      if(rTeam)h+='<span class="aviz-card-team sm">Team</span>';
      h+='<span class="aviz-card-reply-time">'+ago(r.created_at)+'</span>';
      h+='<div class="aviz-menu-wrap" style="margin-left:auto">';
      h+='<button class="aviz-menu-btn" data-menu="'+r.id+'">\\u22EF</button>';
      h+='<div class="aviz-menu" id="aviz-menu-'+r.id+'">';
      h+='<button class="aviz-menu-item aviz-edit-btn" data-id="'+r.id+'" data-kind="reply">Edit</button>';
      h+='<button class="aviz-menu-item aviz-delete-btn danger" data-id="'+r.id+'" data-kind="reply">Delete</button>';
      h+='</div></div>';
      h+='</div>';
      h+='<div class="aviz-card-reply-text">'+esc(r.content)+'</div>';
      h+='</div></div></div>';
    });
    h+='</div>';
  }

  /* Action bar */
  if(!isEditing){
    h+='<div class="aviz-card-actions">';
    if(!isReplying){
      h+='<button class="aviz-card-action aviz-reply-trigger" data-id="'+c.id+'">'+SVG.reply+' Reply</button>';
    }
    if(!c.resolved){
      h+='<button class="aviz-card-action resolve aviz-resolve-btn" data-id="'+c.id+'" data-resolved="false">'+SVG.resolve+' Resolve</button>';
    } else {
      h+='<button class="aviz-card-action reopen aviz-resolve-btn" data-id="'+c.id+'" data-resolved="true">'+SVG.reopen+' Reopen</button>';
    }
    h+='<div class="aviz-menu-wrap">';
    h+='<button class="aviz-menu-btn" data-menu="'+c.id+'">\\u22EF</button>';
    h+='<div class="aviz-menu" id="aviz-menu-'+c.id+'">';
    h+='<button class="aviz-menu-item aviz-edit-btn" data-id="'+c.id+'" data-kind="comment">Edit</button>';
    h+='<button class="aviz-menu-item aviz-delete-btn danger" data-id="'+c.id+'" data-kind="comment">Delete</button>';
    h+='</div></div>';
    h+='</div>';
  }

  /* Reply form */
  if(isReplying){
    h+='<form class="aviz-card-replyform" data-id="'+c.id+'">';
    if(!guestName){
      h+='<input class="aviz-footer-name aviz-reply-name" placeholder="Your name"/>';
    }
    h+='<div class="aviz-card-replyform-row">';
    h+='<div class="aviz-card-replyform-input"><input class="aviz-reply-text" type="text" placeholder="Write a reply\\u2026" autofocus/></div>';
    h+='<button type="submit" class="aviz-card-replyform-send" disabled>'+SVG.send+'</button>';
    h+='</div></form>';
  }

  h+='</div>';
  return h;
}

function resolvedHTML(c){
  var initial=esc((c.author_name||"?").charAt(0).toUpperCase());
  var h='<div class="aviz-resolved-card">';
  if(c.comment_type==="pin"&&c.thread_number){
    h+='<div class="aviz-resolved-pin"><span class="aviz-resolved-pin-num">'+c.thread_number+'</span></div>';
  }
  h+='<div class="aviz-resolved-row">';
  h+='<div class="aviz-resolved-avatar">'+initial+'</div>';
  h+='<div style="min-width:0;flex:1">';
  h+='<span class="aviz-resolved-author">'+esc(c.author_name)+'</span>';
  h+='<p class="aviz-resolved-text">'+esc(c.content)+'</p>';
  h+='<div class="aviz-resolved-foot">';
  h+='<span class="aviz-resolved-tag">'+SVG.resolvedTag+' Resolved'+(c.resolved_by?' by '+esc(c.resolved_by):'')+'</span>';
  h+='<button class="aviz-resolved-reopen aviz-resolve-btn" data-id="'+c.id+'" data-resolved="true">'+SVG.smallReopen+' Reopen</button>';
  h+='</div></div></div></div>';
  return h;
}

function openReactionPicker(anchorBtn,commentId){
  closeReactionPicker();
  var picker=document.createElement("div");
  picker.id="aviz-rxn-picker";
  picker.className="aviz-rxn-picker";
  var html="";
  REACTION_EMOJIS.forEach(function(e){html+='<button data-emoji="'+esc(e)+'">'+esc(e)+'</button>';});
  picker.innerHTML=html;
  panel.appendChild(picker);

  var rect=anchorBtn.getBoundingClientRect();
  var panelRect=panel.getBoundingClientRect();
  var top=rect.top-panelRect.top-picker.offsetHeight-6;
  if(top<8)top=rect.bottom-panelRect.top+6;
  var left=rect.left-panelRect.left;
  var maxLeft=panelRect.width-picker.offsetWidth-8;
  if(left>maxLeft)left=maxLeft;
  if(left<8)left=8;
  picker.style.top=top+"px";picker.style.left=left+"px";

  picker.querySelectorAll("button").forEach(function(btn){
    btn.addEventListener("click",function(e){
      e.stopPropagation();
      var emoji=btn.getAttribute("data-emoji");
      closeReactionPicker();
      toggleReaction(commentId,emoji);
    });
  });

  setTimeout(function(){
    document.addEventListener("click",closeReactionPickerOnOutside,{once:true});
  },0);
}
function closeReactionPicker(){
  var p=panel.querySelector("#aviz-rxn-picker");
  if(p)p.remove();
}
function closeReactionPickerOnOutside(e){
  var p=panel.querySelector("#aviz-rxn-picker");
  if(p&&!p.contains(e.target))closeReactionPicker();
}

function bindThreadEvents(){
  /* Reactions */
  bodyEl.querySelectorAll(".aviz-rxn-bar").forEach(function(bar){
    var cid=bar.getAttribute("data-id");
    bar.querySelectorAll(".aviz-rxn").forEach(function(btn){
      btn.addEventListener("click",function(e){
        e.stopPropagation();
        toggleReaction(cid,btn.getAttribute("data-emoji"));
      });
    });
    var addBtn=bar.querySelector(".aviz-rxn-add");
    if(addBtn){
      addBtn.addEventListener("click",function(e){
        e.stopPropagation();
        openReactionPicker(addBtn,cid);
      });
    }
  });

  /* Resolved section toggle */
  var toggle=bodyEl.querySelector("#aviz-resolved-toggle");
  if(toggle)toggle.addEventListener("click",function(){resolvedExpanded=!resolvedExpanded;renderThreads();});

  /* Screenshot thumbnail click */
  bodyEl.querySelectorAll(".aviz-card-thumb").forEach(function(img){
    img.addEventListener("click",function(e){e.stopPropagation();var s=img.getAttribute("data-src");if(s)window.open(s,"_blank");});
  });

  /* Resolve / reopen */
  bodyEl.querySelectorAll(".aviz-resolve-btn").forEach(function(btn){
    btn.addEventListener("click",function(e){
      e.stopPropagation();
      var cid=btn.getAttribute("data-id");
      var cur=btn.getAttribute("data-resolved")==="true";
      btn.disabled=true;
      fetch(C.api+"?item="+C.item+"&comment_id="+cid+"&resolve="+(cur?"false":"true"),
        {method:"PATCH",headers:{"Content-Type":"application/json"}})
        .then(function(r){return r.json();}).then(function(){
          comments.forEach(function(c){if(c.id===cid)c.resolved=!cur;});refresh();
        }).catch(function(){btn.disabled=false;});
    });
  });

  /* Reply trigger */
  bodyEl.querySelectorAll(".aviz-reply-trigger").forEach(function(btn){
    btn.addEventListener("click",function(e){
      e.stopPropagation();
      replyOpenId=btn.getAttribute("data-id");
      renderThreads();
    });
  });

  /* Reply form submit */
  bodyEl.querySelectorAll(".aviz-card-replyform").forEach(function(form){
    var pid=form.getAttribute("data-id");
    var nameInp=form.querySelector(".aviz-reply-name");
    var textInp=form.querySelector(".aviz-reply-text");
    var sendBtn=form.querySelector(".aviz-card-replyform-send");

    function updateBtn(){
      var n=nameInp?nameInp.value.trim():guestName;
      sendBtn.disabled=!n||!textInp.value.trim();
    }
    if(nameInp)nameInp.addEventListener("input",function(){guestName=nameInp.value;saveGuest();updateBtn();});
    textInp.addEventListener("input",updateBtn);

    form.addEventListener("submit",function(e){
      e.preventDefault();
      var n=nameInp?nameInp.value.trim():guestName;
      var t=textInp.value.trim();if(!n||!t)return;
      if(!guestName){guestName=n;saveGuest();}
      sendBtn.disabled=true;
      postComment({author_name:n,content:t,comment_type:"general",parent_comment_id:pid},function(){
        replyOpenId=null;refresh();
      });
    });
    textInp.addEventListener("keydown",function(ev){
      if(ev.key==="Enter"&&!ev.shiftKey){ev.preventDefault();form.dispatchEvent(new Event("submit",{cancelable:true}));}
      if(ev.key==="Escape"){replyOpenId=null;renderThreads();}
    });
  });

  /* ⋯ menu toggle */
  bodyEl.querySelectorAll(".aviz-menu-btn").forEach(function(btn){
    btn.addEventListener("click",function(e){
      e.stopPropagation();
      var menuId=btn.getAttribute("data-menu");
      var menu=bodyEl.querySelector("#aviz-menu-"+menuId);
      if(!menu)return;
      bodyEl.querySelectorAll(".aviz-menu.open").forEach(function(m){if(m!==menu)m.classList.remove("open");});
      menu.classList.toggle("open");
    });
  });
  document.addEventListener("click",function closeMenus(){
    bodyEl.querySelectorAll(".aviz-menu.open").forEach(function(m){m.classList.remove("open");});
  },{once:true});

  /* Edit */
  bodyEl.querySelectorAll(".aviz-edit-btn").forEach(function(btn){
    btn.addEventListener("click",function(e){
      e.stopPropagation();
      var cid=btn.getAttribute("data-id");
      var kind=btn.getAttribute("data-kind");
      var menu=btn.closest(".aviz-menu");if(menu)menu.classList.remove("open");
      if(kind==="comment"){editingId=cid;renderThreads();return;}
      /* Inline edit for replies */
      var c=comments.find(function(x){return x.id===cid;});
      if(!c)return;
      var replyEl=bodyEl.querySelector('.aviz-card-reply[data-id="'+cid+'"] .aviz-card-reply-text');
      if(!replyEl)return;
      var orig=c.content;
      replyEl.innerHTML='<textarea class="aviz-card-edit-ta" rows="2" style="width:100%">'+esc(orig)+'</textarea>'
        +'<div class="aviz-card-edit-bar" style="margin-top:6px">'
        +'<button class="aviz-card-edit-save">Save</button>'
        +'<button class="aviz-card-edit-cancel">Cancel</button></div>';
      var ta=replyEl.querySelector("textarea");
      var saveB=replyEl.querySelector(".aviz-card-edit-save");
      var cancelB=replyEl.querySelector(".aviz-card-edit-cancel");
      ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);
      cancelB.addEventListener("click",function(ev){ev.stopPropagation();replyEl.textContent=orig;});
      saveB.addEventListener("click",function(ev){
        ev.stopPropagation();
        var nt=ta.value.trim();
        if(!nt||nt===orig){replyEl.textContent=orig;return;}
        saveB.disabled=true;saveB.textContent="Saving\\u2026";
        fetch(C.api+"?item="+C.item+"&comment_id="+cid,
          {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:nt})})
          .then(function(r){return r.json();}).then(function(d){
            if(d&&d.error){replyEl.textContent=orig;return;}
            c.content=nt;refresh();
          }).catch(function(){replyEl.textContent=orig;});
      });
      ta.addEventListener("keydown",function(ev){
        if(ev.key==="Enter"&&(ev.metaKey||ev.ctrlKey)){ev.preventDefault();saveB.click();}
        if(ev.key==="Escape"){ev.stopPropagation();cancelB.click();}
      });
    });
  });

  /* Comment edit save/cancel */
  bodyEl.querySelectorAll(".aviz-card-edit-save").forEach(function(btn){
    var cid=btn.getAttribute("data-id");if(!cid)return;
    btn.addEventListener("click",function(e){
      e.stopPropagation();
      var card=bodyEl.querySelector("#aviz-t-"+cid);if(!card)return;
      var ta=card.querySelector(".aviz-card-edit-ta");if(!ta)return;
      var c=comments.find(function(x){return x.id===cid;});if(!c)return;
      var nt=ta.value.trim();
      if(!nt||nt===c.content){editingId=null;renderThreads();return;}
      btn.disabled=true;btn.textContent="Saving\\u2026";
      fetch(C.api+"?item="+C.item+"&comment_id="+cid,
        {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:nt})})
        .then(function(r){return r.json();}).then(function(d){
          if(d&&d.error){editingId=null;renderThreads();return;}
          c.content=nt;editingId=null;refresh();
        }).catch(function(){editingId=null;renderThreads();});
    });
  });
  bodyEl.querySelectorAll(".aviz-card-edit-cancel").forEach(function(btn){
    var cid=btn.getAttribute("data-id");if(!cid)return;
    btn.addEventListener("click",function(e){e.stopPropagation();editingId=null;renderThreads();});
  });

  /* Delete */
  bodyEl.querySelectorAll(".aviz-delete-btn").forEach(function(btn){
    btn.addEventListener("click",function(e){
      e.stopPropagation();
      var cid=btn.getAttribute("data-id");
      var kind=btn.getAttribute("data-kind");
      var menu=btn.closest(".aviz-menu");if(menu)menu.classList.remove("open");
      var msg=kind==="comment"?"Delete this comment and all its replies?":"Delete this reply?";
      if(!confirm(msg))return;
      btn.disabled=true;
      fetch(C.api+"?item="+C.item+"&comment_id="+cid,{method:"DELETE"})
        .then(function(r){return r.json();}).then(function(d){
          if(d&&d.error){btn.disabled=false;return;}
          if(kind==="comment"){comments=comments.filter(function(c){return c.id!==cid&&c.parent_comment_id!==cid;});}
          else{comments=comments.filter(function(c){return c.id!==cid;});}
          if(replyOpenId===cid)replyOpenId=null;
          if(editingId===cid)editingId=null;
          refresh();
        }).catch(function(){btn.disabled=false;});
    });
  });
}

function scrollToThread(id){
  if(!panelOpen)openPanel();
  setTimeout(function(){
    var el=bodyEl.querySelector("#aviz-t-"+id);
    if(el){
      el.scrollIntoView({behavior:"smooth",block:"center"});
      el.classList.add("highlight");
      setTimeout(function(){el.classList.remove("highlight");},1800);
    }
  },120);
}

function refresh(){renderAnnotations();renderThreads();}
`;
}
