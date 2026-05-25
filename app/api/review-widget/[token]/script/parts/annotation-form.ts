// app/api/review-widget/[token]/script/parts/annotation-form.ts

export function annotationFormJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   SHARED ANNOTATION FORM (pin, box, text_highlight)
   ══════════════════════════════════════════════════════════ */
function showAnnotationForm(type,px,py,extra){
  removePendingAnnotation();
  /* Drop the active-mode class so the page reverts to its natural cursor
     and the hover-box stops shadowing every element — full attention on
     the comment form. removePendingAnnotation() re-arms pin mode. */
  document.documentElement.classList.remove("aviz-mode-pin","aviz-mode-box","aviz-mode-text","aviz-mode-highlight");
  document.documentElement.classList.add("aviz-annotating");
  var hb=document.getElementById("aviz-hover-box");if(hb)hb.classList.remove("show");
  var marker=null;
  if(type==="pin"){
    marker=document.createElement("div");marker.className="aviz-pin pending";
    marker.style.left=px+"px";marker.style.top=py+"px";marker.textContent="+";
    document.body.appendChild(marker);
  }

  var fw=380,vw=window.innerWidth,vh=window.innerHeight;
  var cx=px-window.pageXOffset,cy=py-window.pageYOffset;
  var fx=px+20,fy=py-10;
  if(cx+fw+30>vw)fx=px-fw-20;
  if(cy+220+20>vh)fy=py-220+10;

  /* Guest identity required before posting — trigger onboarding if missing */
  if(!guestName){if(typeof showOnboard==="function"){showOnboard(function(){showAnnotationForm(type,px,py,extra);});}return;}

  var quoteHtml="";
  if(type==="text_highlight"&&extra&&extra.quote){
    var preview=extra.quote.length>180?extra.quote.slice(0,180)+"\\u2026":extra.quote;
    quoteHtml='<div class="aviz-pf-quote">\\u201C'+esc(preview)+'\\u201D</div>';
  }

  var sendIcon='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  var f=document.createElement("div");f.className="aviz-pin-form";
  f.style.left=fx+"px";f.style.top=fy+"px";
  f.innerHTML='<div class="aviz-pf-body">'
      +'<h4>Posting as <strong>'+esc(guestName)+'</strong></h4>'
      +quoteHtml
      +'<textarea class="aviz-pf-text" placeholder="Add a comment\\u2026"></textarea>'
    +'</div>'
    +'<div class="aviz-pf-footer">'
      +'<div class="aviz-pf-priority-slot"></div>'
      +'<div class="aviz-pf-spacer"></div>'
      +'<button class="aviz-pf-cancel">Cancel</button>'
      +'<button class="aviz-pf-send">'+sendIcon+' Post</button>'
    +'</div>';
  document.body.appendChild(f);
  var priorityCtrl=createPriorityControl();
  f.querySelector(".aviz-pf-priority-slot").appendChild(priorityCtrl.element);

  pendingAnnotation={form:f,marker:marker,type:type,x:px,y:py,extra:extra||null};

  var pfText=f.querySelector(".aviz-pf-text");
  var pfSend=f.querySelector(".aviz-pf-send");
  pfText.focus();

  pfSend.addEventListener("click",function(){
    var n=guestName;
    var t=pfText.value.trim();
    if(!n||!t)return;

    /* Text highlight: no screenshot, post directly with highlight offsets */
    if(type==="text_highlight"&&extra){
      pfSend.disabled=true;pfSend.textContent="Posting\\u2026";
      postComment({
        author_name:n,author_email:guestEmail||null,content:t,comment_type:"text_highlight",
        highlight_text:extra.highlight_text,
        highlight_start:extra.highlight_start,
        highlight_end:extra.highlight_end,
        highlight_element_path:extra.highlight_element_path,
        priority:priorityCtrl.getValue()
      },function(d){
        clearPendingHighlight();removePendingAnnotation();refresh();armPinMode();
        if(d)openPanel();
      });
      return;
    }

    pfSend.disabled=true;pfSend.textContent="Capturing\\u2026";

    /* Hide form + existing annotations, keep only pending marker/box visible */
    f.style.display="none";
    annotations.forEach(function(a){if(a.el)a.el.style.display="none";});

    /* Centre the screenshot crop on the pin/box anchor */
    var cropCx=type==="box"&&extra?pctToPxX(extra.x):px;
    var cropCy=type==="box"&&extra?pctToPxY(extra.y):py;
    captureAutoScreenshot(function(dataUrl){
      /* Restore existing annotations */
      annotations.forEach(function(a){if(a.el)a.el.style.display="";});
      pfSend.textContent="Uploading\\u2026";

      function doPost(ssUrl){
        var maxTn=0;comments.forEach(function(c){if(c.thread_number&&c.thread_number>maxTn)maxTn=c.thread_number;});
        var payload={
          author_name:n,author_email:guestEmail||null,content:t,comment_type:type,
          pin_x:pxToPctX(px),pin_y:pxToPctY(py),
          thread_number:maxTn+1,
          screenshot_url:ssUrl||null,
          annotation_data:null,
          priority:priorityCtrl.getValue()
        };
        /* Anchor pin to its click-target element so it doesn't drift when
           the page reflows (images load, fonts swap, etc.). pin_x/pin_y
           stay as the doc-percentage fallback for when the anchor element
           later disappears or the page is restructured. */
        if(type==="pin"&&extra&&extra.anchor){
          payload.annotation_data={anchor:extra.anchor};
        }
        if(type==="box"&&extra){
          payload.pin_x=extra.x;payload.pin_y=extra.y;
          payload.annotation_data={type:"box",width:extra.w,height:extra.h};
        }
        postComment(payload,function(d){
          clearPendingHighlight();removePendingAnnotation();refresh();
          if(d)openPanel();
        });
      }

      if(dataUrl){
        uploadScreenshot(dataUrl,function(url){doPost(url);});
      }else{
        doPost(null);
      }
    },{cropAround:{x:cropCx,y:cropCy}});
  });

  pfText.addEventListener("keydown",function(e){if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)){e.preventDefault();pfSend.click();}});
  f.querySelector(".aviz-pf-cancel").addEventListener("click",function(){clearPendingHighlight();removePendingAnnotation();armPinMode();});
}

/* Unwrap every pending text-highlight mark and clear the pending state.
   Split out from removePendingAnnotation so showAnnotationForm() can call
   removePendingAnnotation() at the start (to tear down the previous form +
   marker + box) WITHOUT destroying the new pending highlight that was just
   placed by highlight-mode immediately before opening the form. */
function clearPendingHighlight(){
  var pms=document.querySelectorAll("mark.aviz-hl-pending");
  for(var i=0;i<pms.length;i++){
    var pm=pms[i];var parent=pm.parentNode;if(!parent)continue;
    while(pm.firstChild)parent.insertBefore(pm.firstChild,pm);
    parent.removeChild(pm);
    if(parent.normalize)parent.normalize();
  }
  window.__avizPendingHighlightMark=null;
  window.__avizPendingHighlight=null;
}

function removePendingAnnotation(){
  document.documentElement.classList.remove("aviz-annotating");
  if(!pendingAnnotation)return;
  pendingAnnotation.form.remove();
  if(pendingAnnotation.marker)pendingAnnotation.marker.remove();
  if(pendingAnnotation.extra&&pendingAnnotation.extra.el)pendingAnnotation.extra.el.remove();
  pendingAnnotation=null;
}
`;
}
