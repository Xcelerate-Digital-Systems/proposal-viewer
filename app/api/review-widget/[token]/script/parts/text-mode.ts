// app/api/review-widget/[token]/script/parts/text-mode.ts

export function textModeJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   TEXT MODE  –  Click to place text, typing IS the comment
   ══════════════════════════════════════════════════════════ */
document.addEventListener("click",function(e){
  if(mode!=="text")return;
  var t=e.target;if(t.closest("#aviz-root")||t.closest("#aviz-onboard")||t.closest("#aviz-tour-backdrop")||t.closest(".aviz-tour-callout")||t.closest(".aviz-pin")||t.closest(".aviz-pin-form")||t.closest(".aviz-box")||t.closest(".aviz-text-ann")||t.closest(".aviz-text-input-wrap"))return;
  e.preventDefault();e.stopPropagation();
  var sx=window.pageXOffset||document.documentElement.scrollLeft;
  var sy=window.pageYOffset||document.documentElement.scrollTop;
  var px=e.clientX+sx,py=e.clientY+sy;

  exitMode();setActiveTool(null);

  /* Require guest identity before showing input */
  if(!guestName){
    if(typeof showOnboard==="function"){
      var cex=e.clientX,cey=e.clientY;
      showOnboard(function(){
        /* Replay the click at the same coordinates once identity is set */
        var ev=new MouseEvent("click",{clientX:cex,clientY:cey,bubbles:true,cancelable:true});
        /* Re-enter text mode so the listener runs */
        setActiveTool("text");setMode("text","Click anywhere to add text");
        document.elementFromPoint(cex,cey).dispatchEvent(ev);
      });
    }
    return;
  }

  var wrap=document.createElement("div");wrap.className="aviz-text-input-wrap";
  wrap.style.left=px+"px";wrap.style.top=py+"px";
  wrap.innerHTML='<textarea class="aviz-ta aviz-text-comment" placeholder="Add your comment\\u2026" rows="2" style="min-height:64px;width:100%"></textarea>'
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

  /* Also place a live-updating text label above */
  var label=document.createElement("div");label.className="aviz-text-ann pending";
  label.style.left=px+"px";label.style.top=(py-28)+"px";
  label.innerHTML='<span class="aviz-text-num">+</span><span class="aviz-text-label"></span>';
  document.body.appendChild(label);
  var labelText=label.querySelector(".aviz-text-label");

  textEl.addEventListener("input",function(){
    labelText.textContent=textEl.value.trim()||"";
  });

  function cleanup(){wrap.remove();label.remove();}

  function doPost(){
    var n=guestName;
    var txt=textEl.value.trim();
    if(!n||!txt)return;
    postBtn.disabled=true;postBtn.textContent="Capturing\\u2026";

    /* Hide form, keep label visible, capture screenshot */
    wrap.style.display="none";
    annotations.forEach(function(a){if(a.el)a.el.style.display="none";});

    captureAutoScreenshot(function(dataUrl){
      annotations.forEach(function(a){if(a.el)a.el.style.display="";});
      postBtn.textContent="Uploading\\u2026";

      function finish(ssUrl){
        var maxTn=0;comments.forEach(function(c){if(c.thread_number&&c.thread_number>maxTn)maxTn=c.thread_number;});
        postComment({
          author_name:n,author_email:guestEmail||null,content:txt,comment_type:"text",
          pin_x:pxToPctX(px),pin_y:pxToPctY(py),
          thread_number:maxTn+1,
          screenshot_url:ssUrl||null,
          annotation_data:{type:"text",overlay_text:txt},
          priority:priorityCtrl.getValue()
        },function(d){
          cleanup();refresh();
          if(d)openPanel();
        });
      }

      if(dataUrl){uploadScreenshot(dataUrl,function(url){finish(url);});}
      else{finish(null);}
    },{cropAround:{x:px,y:py}});
  }

  postBtn.addEventListener("click",doPost);
  textEl.addEventListener("keydown",function(ev){
    if(ev.key==="Enter"&&(ev.metaKey||ev.ctrlKey)){ev.preventDefault();doPost();}
    if(ev.key==="Escape"){cleanup();}
  });
  cancelBtn.addEventListener("click",cleanup);
},true);
`;
}