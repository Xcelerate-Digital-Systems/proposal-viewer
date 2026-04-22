// app/api/review-widget/[token]/script/parts/highlight-mode.ts

export function highlightModeJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   HIGHLIGHT MODE  –  Select page text, leave a comment
   ══════════════════════════════════════════════════════════ */

function buildHighlightElementPath(node){
  var parts=[];
  var current=node.nodeType===Node.TEXT_NODE?node.parentNode:node;
  while(current&&current!==document.body&&current.parentNode){
    var parent=current.parentNode;
    var children=Array.prototype.slice.call(parent.children||[]);
    var idx=children.indexOf(current);
    if(idx<0)break;
    var tag=current.tagName?current.tagName.toLowerCase():"";
    if(!tag)break;
    parts.unshift(tag+":nth-child("+(idx+1)+")");
    current=parent;
  }
  return parts.join(" > ");
}

function getHighlightTextOffset(root,targetNode,nodeOffset){
  var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null);
  var offset=0,node;
  while((node=walker.nextNode())){
    if(node===targetNode)return offset+nodeOffset;
    offset+=(node.textContent||"").length;
  }
  return offset;
}

document.addEventListener("mouseup",function(){
  if(mode!=="highlight")return;
  setTimeout(function(){
    var sel=window.getSelection();
    if(!sel||sel.isCollapsed||!sel.rangeCount)return;
    var range=sel.getRangeAt(0);
    var text=sel.toString().trim();
    if(!text)return;

    /* Ignore selections inside the widget UI */
    var startEl=range.startContainer.nodeType===Node.TEXT_NODE?range.startContainer.parentNode:range.startContainer;
    if(!startEl||startEl.closest("#aviz-root")||startEl.closest(".aviz-pin-form")||startEl.closest(".aviz-text-input-wrap"))return;

    var rect=range.getBoundingClientRect();
    var sx=window.pageXOffset||document.documentElement.scrollLeft;
    var sy=window.pageYOffset||document.documentElement.scrollTop;
    var px=(rect.left+rect.right)/2+sx;
    var py=rect.top+sy;

    var startOffset=getHighlightTextOffset(document.body,range.startContainer,range.startOffset);
    var endOffset=getHighlightTextOffset(document.body,range.endContainer,range.endOffset);
    var elementPath=buildHighlightElementPath(range.startContainer);

    /* Require guest identity before showing comment input */
    if(!guestName){
      if(typeof showOnboard==="function"){
        showOnboard(function(){
          /* After identity capture, re-prompt user to re-select */
          barMsg.textContent="Re-select the text to leave a highlighted comment";
          bar.classList.add("show");
        });
      }
      return;
    }

    /* Clear browser selection so the form isn't blocked by selection state */
    sel.removeAllRanges();

    var wrap=document.createElement("div");wrap.className="aviz-text-input-wrap";
    wrap.style.left=px+"px";wrap.style.top=(py+20)+"px";
    var preview=text.length>120?text.slice(0,120)+"\\u2026":text;
    wrap.innerHTML='<div class="aviz-pf-quote" style="max-width:300px">\\u201C'+esc(preview)+'\\u201D</div>'
      +'<textarea class="aviz-ta aviz-text-comment" placeholder="Comment on the highlighted text\\u2026" rows="2" style="min-height:64px;width:100%"></textarea>'
      +'<div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end;align-items:center">'
      +'<span style="flex:1;font-size:11px;color:#9ca3af">Posting as <strong style="color:#374151;font-weight:600">'+esc(guestName)+'</strong></span>'
      +'<div class="aviz-priority-slot"></div>'
      +'<button class="aviz-btn aviz-btn-g aviz-text-cancel">Cancel</button>'
      +'<button class="aviz-btn aviz-btn-p aviz-text-post">Post</button></div>';
    document.body.appendChild(wrap);
    var priorityCtrl=createPriorityControl();
    wrap.querySelector(".aviz-priority-slot").appendChild(priorityCtrl.element);

    var textEl=wrap.querySelector(".aviz-text-comment");
    var postBtn=wrap.querySelector(".aviz-text-post");
    var cancelBtn=wrap.querySelector(".aviz-text-cancel");
    textEl.focus();

    function cleanup(){wrap.remove();}

    function doPost(){
      var n=guestName;
      var txt=textEl.value.trim();
      if(!n||!txt)return;
      postBtn.disabled=true;postBtn.textContent="Posting\\u2026";

      postComment({
        author_name:n,author_email:guestEmail||null,content:txt,comment_type:"text_highlight",
        highlight_text:text,highlight_start:startOffset,highlight_end:endOffset,highlight_element_path:elementPath,
        priority:priorityCtrl.getValue()
      },function(d){
        cleanup();refresh();armPinMode();
        if(d)openPanel();
      });
    }

    postBtn.addEventListener("click",doPost);
    textEl.addEventListener("keydown",function(ev){
      if(ev.key==="Enter"&&(ev.metaKey||ev.ctrlKey)){ev.preventDefault();doPost();}
      if(ev.key==="Escape"){cleanup();}
    });
    cancelBtn.addEventListener("click",cleanup);
  },10);
});
`;
}
