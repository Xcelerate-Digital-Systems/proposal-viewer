// Mention editor + sanitiser for the embed widget. The React reviewer uses
// TipTap; the widget can't ship a 100kb editor into a third-party page, so
// this is a small contenteditable-based equivalent that emits the same
// HTML shape (<span data-type="mention" data-id data-label>@Name</span>)
// so the existing server-side mention extraction in /api/review-notify
// works without forking the format.
//
// Public API (attached to the widget global `AVZ` namespace):
//   AVZ.mention.attach(el)         — turn an empty <div contenteditable="true">
//                                    into a mention-aware editor
//   AVZ.mention.getHTML(el)        — read the sanitised HTML out
//   AVZ.mention.setHTML(el, html)  — replace contents (used on edit)
//   AVZ.mention.clear(el)          — reset to empty
//   AVZ.mention.renderContent(html)— sanitise a comment's stored HTML for
//                                    safe display via innerHTML

export function mentionsJS(): string {
  return `
/* ── Mention editor + display sanitiser ────────────────────────────── */
window.AVZ=window.AVZ||{};
(function(){
  var dropdown=null;            /* singleton, created on first @ trigger */
  var dropdownItems=[];
  var dropdownIndex=0;
  var activeEditor=null;        /* the contenteditable currently driving the dropdown */
  var triggerRange=null;        /* Range covering the @query text we'll replace on pick */

  function escAttr(s){
    return String(s)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;");
  }

  /* The hand-rolled sanitiser used to render stored comment HTML in the
     panel. Allowlists <p>, <br>, and mention spans (with their data-*
     + class attributes). Everything else is dropped. Mirrors the
     DOMPurify config used in the React CommentContent component. */
  function sanitiseDisplay(html){
    if(!html)return"";
    var tmp=document.createElement("div");
    tmp.innerHTML=String(html);
    var walker=document.createTreeWalker(tmp,NodeFilter.SHOW_ELEMENT,null);
    var toRemove=[];
    var node;
    while((node=walker.nextNode())){
      var tag=node.tagName.toLowerCase();
      if(tag==="p"||tag==="br"){
        /* strip all attributes */
        for(var i=node.attributes.length-1;i>=0;i--){node.removeAttribute(node.attributes[i].name);}
        continue;
      }
      if(tag==="span"&&node.getAttribute("data-type")==="mention"){
        var keep=["data-type","data-id","data-label"];
        var id=node.getAttribute("data-id")||"";
        var label=node.getAttribute("data-label")||id;
        for(var j=node.attributes.length-1;j>=0;j--){
          var n=node.attributes[j].name;
          if(keep.indexOf(n)===-1)node.removeAttribute(n);
        }
        node.setAttribute("class","aviz-mention-pill");
        node.setAttribute("data-id",id);
        node.setAttribute("data-label",label);
        node.textContent="@"+label;
        continue;
      }
      /* unknown tag — unwrap (keep children) */
      toRemove.push(node);
    }
    for(var k=0;k<toRemove.length;k++){
      var el=toRemove[k];
      while(el.firstChild)el.parentNode.insertBefore(el.firstChild,el);
      el.parentNode.removeChild(el);
    }
    return tmp.innerHTML;
  }

  /* When the user submits, we serialise the editor's HTML for the server.
     Mention spans need to round-trip with data-* attrs intact; we strip
     anything else (browser-inserted styles, font tags from pastes, etc.). */
  function serialiseEditor(el){
    if(!el)return"";
    /* Move text-only content into <p> wrappers so the format matches
       TipTap's output (<p>...</p>). Browsers vary on whether plain text
       in a contenteditable lives directly under the root or inside <div>;
       normalise both. */
    var clone=el.cloneNode(true);
    /* divs that browsers insert on Enter — flatten to <p>. */
    var divs=clone.querySelectorAll("div");
    for(var i=0;i<divs.length;i++){
      var d=divs[i];
      var p=document.createElement("p");
      while(d.firstChild)p.appendChild(d.firstChild);
      d.parentNode.replaceChild(p,d);
    }
    if(clone.children.length===0){
      var wrap=document.createElement("p");
      while(clone.firstChild)wrap.appendChild(clone.firstChild);
      clone.appendChild(wrap);
    }
    return sanitiseDisplay(clone.innerHTML);
  }

  function plainText(el){
    return (el?el.textContent:"").replace(/\\u00A0/g," ").trim();
  }

  /* Build (once) and return the floating dropdown element. */
  function getDropdown(){
    if(dropdown)return dropdown;
    dropdown=document.createElement("div");
    dropdown.className="aviz-mention-dropdown";
    dropdown.style.display="none";
    document.body.appendChild(dropdown);
    return dropdown;
  }

  function hideDropdown(){
    if(dropdown)dropdown.style.display="none";
    activeEditor=null;
    triggerRange=null;
    dropdownItems=[];
  }

  function renderDropdownItems(){
    var d=getDropdown();
    if(dropdownItems.length===0){
      d.innerHTML='<div class="aviz-mention-empty">No matches</div>';
      return;
    }
    var html="";
    for(var i=0;i<dropdownItems.length;i++){
      var p=dropdownItems[i];
      var initial=(p.name||p.email||"?").charAt(0).toUpperCase();
      var sub=p.name&&p.email&&p.name.toLowerCase()!==p.email.toLowerCase()
        ?'<span class="aviz-mention-email">'+escAttr(p.email)+'</span>'
        :'';
      html+='<button type="button" class="aviz-mention-item'+(i===dropdownIndex?' active':'')+'" data-idx="'+i+'">'
        +'<span class="aviz-mention-avatar">'+escAttr(initial)+'</span>'
        +'<span class="aviz-mention-name">'+escAttr(p.name||p.email)+'</span>'
        +sub
        +'<span class="aviz-mention-kind aviz-mention-kind-'+escAttr(p.kind)+'">'+escAttr(p.kind)+'</span>'
        +'</button>';
    }
    d.innerHTML=html;
    var btns=d.querySelectorAll(".aviz-mention-item");
    for(var j=0;j<btns.length;j++){
      (function(idx){
        btns[idx].addEventListener("mousedown",function(e){
          /* mousedown not click so we beat the editor's blur handler */
          e.preventDefault();
          pickItem(idx);
        });
      })(j);
    }
  }

  /* Anchor the dropdown under the caret. We compute the rect from a
     temporary range at the current selection — works inside any
     contenteditable, including nested elements. */
  function positionDropdown(){
    var sel=window.getSelection();
    if(!sel||sel.rangeCount===0)return;
    var r=sel.getRangeAt(0).cloneRange();
    r.collapse(true);
    var rect=r.getBoundingClientRect();
    /* zero-width caret produces 0,0,0,0 in some browsers — fall back to
       the editor's own rect. */
    if(rect.width===0&&rect.height===0&&activeEditor){
      rect=activeEditor.getBoundingClientRect();
    }
    var d=getDropdown();
    var dh=d.offsetHeight||200;
    var top=window.scrollY+rect.bottom+4;
    /* flip above when overflowing */
    if(rect.bottom+dh>window.innerHeight-8){
      top=window.scrollY+rect.top-dh-4;
    }
    var left=Math.max(8,Math.min(window.scrollX+rect.left,window.scrollX+window.innerWidth-260));
    d.style.top=top+"px";
    d.style.left=left+"px";
    d.style.display="block";
  }

  function pickItem(idx){
    var p=dropdownItems[idx];
    if(!p||!triggerRange||!activeEditor){hideDropdown();return;}
    /* Replace the @query range with a mention span + trailing space. */
    var sel=window.getSelection();
    sel.removeAllRanges();
    sel.addRange(triggerRange);
    /* Delete the @query characters first */
    triggerRange.deleteContents();
    var span=document.createElement("span");
    span.setAttribute("data-type","mention");
    span.setAttribute("data-id",p.id);
    span.setAttribute("data-label",p.name||p.email);
    span.setAttribute("class","aviz-mention-pill");
    span.setAttribute("contenteditable","false");
    span.textContent="@"+(p.name||p.email);
    triggerRange.insertNode(span);
    /* Insert a trailing space so the caret moves outside the pill. */
    var spaceNode=document.createTextNode("\\u00A0");
    span.parentNode.insertBefore(spaceNode,span.nextSibling);
    var caret=document.createRange();
    caret.setStartAfter(spaceNode);
    caret.collapse(true);
    sel.removeAllRanges();
    sel.addRange(caret);
    activeEditor.dispatchEvent(new Event("input",{bubbles:true}));
    hideDropdown();
  }

  /* On every input, look back from the caret to find an unbroken
     "@query" string. If found and at most 30 chars of letters/numbers,
     show the dropdown filtered by query. Otherwise hide. */
  function syncDropdown(editor){
    var sel=window.getSelection();
    if(!sel||sel.rangeCount===0){hideDropdown();return;}
    var range=sel.getRangeAt(0);
    if(!editor.contains(range.startContainer)){hideDropdown();return;}
    var textNode=range.startContainer;
    if(textNode.nodeType!==Node.TEXT_NODE){hideDropdown();return;}
    var caretOffset=range.startOffset;
    var text=textNode.nodeValue.slice(0,caretOffset);
    var atIdx=text.lastIndexOf("@");
    if(atIdx<0){hideDropdown();return;}
    var before=text.charAt(atIdx-1);
    /* Only trigger at start-of-text or after whitespace/punctuation */
    if(atIdx>0&&!/[\\s\\u00A0(,;:!?>\\-]/.test(before)){hideDropdown();return;}
    var query=text.slice(atIdx+1);
    if(query.length>30||/\\s/.test(query)){hideDropdown();return;}
    /* Build replacement range covering "@query" */
    var tr=document.createRange();
    tr.setStart(textNode,atIdx);
    tr.setEnd(textNode,caretOffset);
    triggerRange=tr;
    activeEditor=editor;
    var pool=(typeof participants!=="undefined"&&participants)?participants:[];
    var q=query.toLowerCase();
    dropdownItems=pool.filter(function(p){
      if(!q)return true;
      return (p.name||"").toLowerCase().indexOf(q)>=0||(p.email||"").toLowerCase().indexOf(q)>=0;
    }).slice(0,8);
    dropdownIndex=0;
    renderDropdownItems();
    positionDropdown();
  }

  function onKeyDown(e){
    if(!dropdown||dropdown.style.display==="none")return;
    if(e.key==="ArrowDown"){
      e.preventDefault();
      dropdownIndex=(dropdownIndex+1)%Math.max(dropdownItems.length,1);
      renderDropdownItems();
    } else if(e.key==="ArrowUp"){
      e.preventDefault();
      dropdownIndex=(dropdownIndex-1+dropdownItems.length)%Math.max(dropdownItems.length,1);
      renderDropdownItems();
    } else if(e.key==="Enter"||e.key==="Tab"){
      if(dropdownItems.length>0){
        e.preventDefault();
        pickItem(dropdownIndex);
      }
    } else if(e.key==="Escape"){
      e.preventDefault();
      hideDropdown();
    }
  }

  function attach(el){
    if(!el||el.__avizMentionBound)return;
    el.__avizMentionBound=true;
    el.setAttribute("contenteditable","true");
    el.addEventListener("input",function(){syncDropdown(el);});
    el.addEventListener("keydown",onKeyDown);
    el.addEventListener("blur",function(){
      /* Hide on blur, but defer so a click on a dropdown item still fires */
      setTimeout(function(){if(document.activeElement!==el)hideDropdown();},100);
    });
  }

  function clear(el){
    if(!el)return;
    el.innerHTML="";
  }

  function setHTML(el,html){
    if(!el)return;
    el.innerHTML=sanitiseDisplay(html||"");
    /* Make every mention span non-editable so backspace deletes it whole. */
    var pills=el.querySelectorAll('span[data-type="mention"]');
    for(var i=0;i<pills.length;i++){
      pills[i].setAttribute("contenteditable","false");
    }
  }

  AVZ.mention={
    attach:attach,
    getHTML:serialiseEditor,
    getPlainText:plainText,
    setHTML:setHTML,
    clear:clear,
    renderContent:sanitiseDisplay
  };
})();
`;
}
