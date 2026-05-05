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
    if(!startEl||startEl.closest("#aviz-root")||startEl.closest("#aviz-onboard")||startEl.closest("#aviz-tour-backdrop")||startEl.closest(".aviz-tour-callout")||startEl.closest(".aviz-pin-form")||startEl.closest(".aviz-text-input-wrap"))return;

    var rect=range.getBoundingClientRect();
    var sx=window.pageXOffset||document.documentElement.scrollLeft;
    var sy=window.pageYOffset||document.documentElement.scrollTop;
    var px=(rect.left+rect.right)/2+sx;
    var py=rect.top+sy;

    var startOffset=getHighlightTextOffset(document.body,range.startContainer,range.startOffset);
    var endOffset=getHighlightTextOffset(document.body,range.endContainer,range.endOffset);
    var elementPath=buildHighlightElementPath(range.startContainer);

    /* Persist the pending range as offsets so renderAnnotations() can
       re-create the yellow mark on every refresh — survives multi-element
       selections (where surroundContents would throw) and any subsequent
       refresh that unwraps existing marks. */
    window.__avizPendingHighlight={start:startOffset,end:endOffset};
    window.__avizPendingHighlightMark=null;
    if(typeof renderPendingHighlight==="function")renderPendingHighlight();

    /* Clear browser selection so the form isn't blocked by selection state */
    sel.removeAllRanges();

    /* Delegate to the shared annotation form. It handles guest onboarding,
       priority, and posting; text_highlight branch skips the screenshot. */
    showAnnotationForm("text_highlight",px,py,{
      quote:text,
      highlight_text:text,
      highlight_start:startOffset,
      highlight_end:endOffset,
      highlight_element_path:elementPath
    });
  },10);
});
`;
}
