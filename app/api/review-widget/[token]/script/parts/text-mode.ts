// app/api/review-widget/[token]/script/parts/text-mode.ts

export function textModeJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   TEXT MODE  –  Click to place text, typing IS the comment
   ══════════════════════════════════════════════════════════ */
document.addEventListener("click",function(e){
  if(mode!=="text")return;
  var t=e.target;if(t.closest("#aviz-root")||t.closest(".aviz-pin")||t.closest(".aviz-pin-form")||t.closest(".aviz-box")||t.closest(".aviz-text-ann")||t.closest(".aviz-text-input-wrap"))return;
  e.preventDefault();e.stopPropagation();
  var sx=window.pageXOffset||document.documentElement.scrollLeft;
  var sy=window.pageYOffset||document.documentElement.scrollTop;
  var px=e.clientX+sx,py=e.clientY+sy;

  exitMode();setActiveTool(null);

  /* Name prompt if needed */
  var nameNeeded=!guestName;
  var wrap=document.createElement("div");wrap.className="aviz-text-input-wrap";
  wrap.style.left=px+"px";wrap.style.top=py+"px";
  wrap.innerHTML=(nameNeeded?'<input class="aviz-inp aviz-text-name" placeholder="Your name" style="margin-bottom:6px;width:100%"/>':'')
    +'<textarea class="aviz-ta aviz-text-comment" placeholder="Add your comment\\u2026" rows="2" style="min-height:48px;width:100%"></textarea>'
    +'<div style="display:flex;gap:6px;margin-top:8px;justify-content:flex-end">'
    +'<button class="aviz-btn aviz-btn-g aviz-text-cancel">Cancel</button>'
    +'<button class="aviz-btn aviz-btn-p aviz-text-post">Post</button></div>';
  document.body.appendChild(wrap);

  var nameInpEl=wrap.querySelector(".aviz-text-name");
  var textEl=wrap.querySelector(".aviz-text-comment");
  var postBtn=wrap.querySelector(".aviz-text-post");
  var cancelBtn=wrap.querySelector(".aviz-text-cancel");
  (nameInpEl||textEl).focus();

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
    var n=nameInpEl?nameInpEl.value.trim():guestName;
    var txt=textEl.value.trim();
    if(!n||!txt)return;
    guestName=n;saveGuest();
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
          author_name:n,content:txt,comment_type:"text",
          pin_x:pxToPctX(px),pin_y:pxToPctY(py),
          thread_number:maxTn+1,
          screenshot_url:ssUrl||null,
          annotation_data:{type:"text",overlay_text:txt}
        },function(d){
          cleanup();refresh();
          if(d)openPanel();
        });
      }

      if(dataUrl){uploadScreenshot(dataUrl,function(url){finish(url);});}
      else{finish(null);}
    });
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