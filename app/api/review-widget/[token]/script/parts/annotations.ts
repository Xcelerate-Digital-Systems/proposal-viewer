// app/api/review-widget/[token]/script/parts/annotations.ts

export function annotationsJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   RENDER ANNOTATIONS ON PAGE (from loaded comments)
   ══════════════════════════════════════════════════════════ */
function renderAnnotations(){
  annotations.forEach(function(a){if(a.el)a.el.remove();});annotations=[];
  comments.forEach(function(c){
    if(c.parent_comment_id)return;
    if((c.comment_type==="pin"||(c.comment_type==="text"&&!c.annotation_data))&&c.pin_x!=null&&c.pin_y!=null){
      var el=document.createElement("div");el.className="aviz-pin"+(c.resolved?" resolved":"");
      el.style.left=pctToPxX(c.pin_x)+"px";el.style.top=pctToPxY(c.pin_y)+"px";
      el.textContent=c.thread_number||"";
      el.addEventListener("click",function(e){e.stopPropagation();openPanel();scrollToThread(c.id);});
      document.body.appendChild(el);annotations.push({id:c.id,el:el,type:"pin"});
    }
    else if(c.comment_type==="box"&&c.annotation_data&&c.pin_x!=null){
      var d=c.annotation_data;
      var el=document.createElement("div");el.className="aviz-box"+(c.resolved?" resolved":"");
      el.style.left=pctToPxX(c.pin_x)+"px";el.style.top=pctToPxY(c.pin_y)+"px";
      el.style.width=pctToPxX(d.width)+"px";el.style.height=pctToPxY(d.height)+"px";
      el.innerHTML='<span class="aviz-box-num">'+(c.thread_number||"")+'</span>';
      el.addEventListener("click",function(e){e.stopPropagation();openPanel();scrollToThread(c.id);});
      document.body.appendChild(el);annotations.push({id:c.id,el:el,type:"box"});
    }
    else if(c.comment_type==="text"&&c.annotation_data&&c.pin_x!=null){
      var d=c.annotation_data;
      var el=document.createElement("div");el.className="aviz-text-ann"+(c.resolved?" resolved":"");
      el.style.left=pctToPxX(c.pin_x)+"px";el.style.top=pctToPxY(c.pin_y)+"px";
      el.innerHTML='<span class="aviz-text-num">'+(c.thread_number||"")+'</span>'
        +'<span class="aviz-text-label">'+esc(d.overlay_text||"")+'</span>';
      el.addEventListener("click",function(e){e.stopPropagation();openPanel();scrollToThread(c.id);});
      document.body.appendChild(el);annotations.push({id:c.id,el:el,type:"text"});
    }
  });
  renderTextHighlights();
}

/* ── Text-highlight rendering (yellow marks + numbered badges) ── */
function findHighlightNodeAtOffset(target){
  var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{
    acceptNode:function(n){
      var p=n.parentNode;
      if(!p)return NodeFilter.FILTER_REJECT;
      /* Skip widget UI + our own highlight wrappers */
      if(p.closest&&(p.closest("#aviz-root")||p.closest("#aviz-onboard")||p.closest("mark.aviz-hl")||p.closest(".aviz-pin-form")||p.closest(".aviz-text-input-wrap")||p.closest("#aviz-panel")))return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  var accumulated=0,node;
  while((node=walker.nextNode())){
    var len=(node.textContent||"").length;
    if(accumulated+len>=target)return{node:node,offset:target-accumulated};
    accumulated+=len;
  }
  return null;
}

function unwrapExistingHighlights(){
  var marks=document.querySelectorAll("mark.aviz-hl");
  for(var i=0;i<marks.length;i++){
    var m=marks[i];
    var badges=m.querySelectorAll(".aviz-hl-badge");
    for(var j=0;j<badges.length;j++)badges[j].remove();
    var parent=m.parentNode;if(!parent)continue;
    while(m.firstChild)parent.insertBefore(m.firstChild,m);
    parent.removeChild(m);
    if(parent.normalize)parent.normalize();
  }
}

function renderTextHighlights(){
  unwrapExistingHighlights();
  /* Sort descending so wrapping earlier ranges doesn't shift later offsets */
  var highlights=comments.filter(function(c){
    return !c.parent_comment_id&&c.comment_type==="text_highlight"
      &&c.highlight_start!=null&&c.highlight_end!=null;
  }).sort(function(a,b){return (b.highlight_start||0)-(a.highlight_start||0);});

  highlights.forEach(function(c){
    var startPos=findHighlightNodeAtOffset(c.highlight_start);
    var endPos=findHighlightNodeAtOffset(c.highlight_end);
    if(!startPos||!endPos)return;
    try{
      var range=document.createRange();
      range.setStart(startPos.node,startPos.offset);
      range.setEnd(endPos.node,endPos.offset);
      var mark=document.createElement("mark");
      mark.className="aviz-hl"+(c.resolved?" resolved":"");
      mark.setAttribute("data-comment-id",c.id);
      range.surroundContents(mark);
      mark.addEventListener("click",function(e){e.stopPropagation();openPanel();scrollToThread(c.id);});
      if(c.thread_number!=null){
        var badge=document.createElement("span");
        badge.className="aviz-hl-badge";
        badge.textContent=String(c.thread_number);
        badge.setAttribute("contenteditable","false");
        badge.addEventListener("click",function(e){e.stopPropagation();openPanel();scrollToThread(c.id);});
        mark.appendChild(badge);
      }
    }catch(e){/* range spans element boundaries — skip */}
  });
}

var resizeTimer;
window.addEventListener("resize",function(){clearTimeout(resizeTimer);resizeTimer=setTimeout(renderAnnotations,150);});
`;
}