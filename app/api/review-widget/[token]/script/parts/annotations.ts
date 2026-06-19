// app/api/review-widget/[token]/script/parts/annotations.ts

export function annotationsJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   RENDER ANNOTATIONS ON PAGE (from loaded comments)
   ══════════════════════════════════════════════════════════ */
/* Pin coordinate resolution: prefer the stored DOM-element anchor (so the
   pin stays glued to its target across layout shifts), fall back to the
   document-percentage pin_x/pin_y for legacy pins or vanished anchors. */
function pinXY(c){
  var ad=c.annotation_data;
  if(ad&&ad.anchor){
    var p=resolveAnchor(ad.anchor);
    if(p)return p;
  }
  if(c.pin_x==null||c.pin_y==null)return null;
  return{x:pctToPxX(c.pin_x),y:pctToPxY(c.pin_y)};
}
function renderAnnotations(){
  annotations.forEach(function(a){if(a.el)a.el.remove();});annotations=[];
  comments.forEach(function(c){
    if(c.parent_comment_id)return;
    if((c.comment_type==="pin"||(c.comment_type==="text"&&!c.annotation_data))&&c.pin_x!=null&&c.pin_y!=null){
      var p=pinXY(c);if(!p)return;
      var el=document.createElement("div");el.className="aviz-pin"+(c.resolved?" resolved":"");
      el.style.left=p.x+"px";el.style.top=p.y+"px";
      el.textContent=c.thread_number||"";
      el.addEventListener("click",function(e){e.stopPropagation();openPanel();scrollToThread(c.id);});
      document.body.appendChild(el);annotations.push({id:c.id,el:el,type:"pin",commentId:c.id});
    }
    else if(c.comment_type==="box"&&c.annotation_data&&c.pin_x!=null){
      var d=c.annotation_data;
      var el=document.createElement("div");el.className="aviz-box"+(c.resolved?" resolved":"");
      el.style.left=pctToPxX(c.pin_x)+"px";el.style.top=pctToPxY(c.pin_y)+"px";
      el.style.width=pctToPxX(d.width)+"px";el.style.height=pctToPxY(d.height)+"px";
      el.innerHTML='<span class="aviz-box-num">'+esc(String(c.thread_number||""))+'</span>';
      el.addEventListener("click",function(e){e.stopPropagation();openPanel();scrollToThread(c.id);});
      document.body.appendChild(el);annotations.push({id:c.id,el:el,type:"box"});
    }
    else if(c.comment_type==="text"&&c.annotation_data&&c.pin_x!=null){
      var d=c.annotation_data;
      var el=document.createElement("div");el.className="aviz-text-ann"+(c.resolved?" resolved":"");
      el.style.left=pctToPxX(c.pin_x)+"px";el.style.top=pctToPxY(c.pin_y)+"px";
      el.innerHTML='<span class="aviz-text-num">'+esc(String(c.thread_number||""))+'</span>'
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
  var marks=document.querySelectorAll("mark.aviz-hl, mark.aviz-hl-pending");
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

/* Wrap a [start,end] offset range with a <mark> of the given class. Falls
   back to wrapping each contained text node individually when the range
   crosses element boundaries (surroundContents would throw). */
function wrapOffsetRange(start,end,markClass,onCreate){
  if(start==null||end==null||end<=start)return null;
  var startPos=findHighlightNodeAtOffset(start);
  var endPos=findHighlightNodeAtOffset(end);
  if(!startPos||!endPos)return null;
  try{
    var range=document.createRange();
    range.setStart(startPos.node,startPos.offset);
    range.setEnd(endPos.node,endPos.offset);
    var mark=document.createElement("mark");
    mark.className=markClass;
    range.surroundContents(mark);
    if(onCreate)onCreate(mark);
    return mark;
  }catch(e){
    /* Range spans element boundaries — wrap each contained text node */
    var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null);
    var accumulated=0,first=null,node;
    while((node=walker.nextNode())){
      var len=(node.textContent||"").length;
      var nodeStart=accumulated;var nodeEnd=accumulated+len;
      accumulated+=len;
      if(nodeEnd<=start||nodeStart>=end)continue;
      if(node.parentNode&&node.parentNode.closest&&(node.parentNode.closest("#aviz-root")||node.parentNode.closest("mark.aviz-hl")||node.parentNode.closest("mark.aviz-hl-pending")))continue;
      var s=Math.max(0,start-nodeStart);
      var en=Math.min(len,end-nodeStart);
      if(en<=s)continue;
      try{
        var r=document.createRange();
        r.setStart(node,s);r.setEnd(node,en);
        var m=document.createElement("mark");
        m.className=markClass;
        r.surroundContents(m);
        if(!first){first=m;if(onCreate)onCreate(m);}
      }catch(_){/* skip this segment */}
    }
    return first;
  }
}

function renderPendingHighlight(){
  var ph=window.__avizPendingHighlight;
  if(!ph)return;
  wrapOffsetRange(ph.start,ph.end,"aviz-hl-pending",function(m){
    window.__avizPendingHighlightMark=m;
  });
}

function renderTextHighlights(){
  unwrapExistingHighlights();
  /* Sort descending so wrapping earlier ranges doesn't shift later offsets */
  var highlights=comments.filter(function(c){
    return !c.parent_comment_id&&c.comment_type==="text_highlight"
      &&c.highlight_start!=null&&c.highlight_end!=null;
  }).sort(function(a,b){return (b.highlight_start||0)-(a.highlight_start||0);});

  highlights.forEach(function(c){
    wrapOffsetRange(c.highlight_start,c.highlight_end,"aviz-hl"+(c.resolved?" resolved":""),function(mark){
      mark.setAttribute("data-comment-id",c.id);
      mark.addEventListener("click",function(e){e.stopPropagation();openPanel();scrollToThread(c.id);});
      if(c.thread_number!=null){
        var badge=document.createElement("span");
        badge.className="aviz-hl-badge";
        badge.textContent=String(c.thread_number);
        badge.setAttribute("contenteditable","false");
        badge.addEventListener("click",function(e){e.stopPropagation();openPanel();scrollToThread(c.id);});
        mark.appendChild(badge);
      }
    });
  });
  renderPendingHighlight();
}

var resizeTimer;
function scheduleRender(){clearTimeout(resizeTimer);resizeTimer=setTimeout(renderAnnotations,150);}
window.addEventListener("resize",scheduleRender);
/* Anchored pins depend on their target element's getBoundingClientRect(),
   which shifts whenever the page reflows (late image loads, web font swap,
   dynamic content insertion, etc). ResizeObserver on body catches every
   layout change cheaply; window.load covers initial image loads. */
window.addEventListener("load",scheduleRender);
try{
  if(typeof ResizeObserver==="function"){
    var __avizRO=new ResizeObserver(scheduleRender);
    __avizRO.observe(document.body);
  }
}catch(e){}
`;
}