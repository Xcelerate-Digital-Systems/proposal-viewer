// app/api/review-widget/[token]/script/parts/annotation-form.ts

export function annotationFormJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   SHARED ANNOTATION FORM (pin, box)
   ══════════════════════════════════════════════════════════ */
function showAnnotationForm(type,px,py,extra){
  removePendingAnnotation();
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

  var f=document.createElement("div");f.className="aviz-pin-form";
  f.style.left=fx+"px";f.style.top=fy+"px";
  var typeLabel=type==="pin"?"Pin Comment":"Box Comment";
  f.innerHTML='<h4>'+typeLabel+'</h4>'
    +'<textarea class="aviz-ta aviz-pf-text" placeholder="Describe your feedback\\u2026" style="min-height:80px"></textarea>'
    +'<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;align-items:center">'
    +'<span style="flex:1;font-size:11px;color:#9ca3af">Posting as <strong style="color:#374151;font-weight:600">'+esc(guestName)+'</strong></span>'
    +'<button class="aviz-btn aviz-btn-g aviz-pf-cancel">Cancel</button>'
    +'<button class="aviz-btn aviz-btn-p aviz-pf-send">Post</button></div>';
  document.body.appendChild(f);

  pendingAnnotation={form:f,marker:marker,type:type,x:px,y:py,extra:extra||null};

  var pfText=f.querySelector(".aviz-pf-text");
  var pfSend=f.querySelector(".aviz-pf-send");
  pfText.focus();

  pfSend.addEventListener("click",function(){
    var n=guestName;
    var t=pfText.value.trim();
    if(!n||!t)return;
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
          annotation_data:null
        };
        if(type==="box"&&extra){
          payload.pin_x=extra.x;payload.pin_y=extra.y;
          payload.annotation_data={type:"box",width:extra.w,height:extra.h};
        }
        postComment(payload,function(d){
          removePendingAnnotation();refresh();
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
  f.querySelector(".aviz-pf-cancel").addEventListener("click",function(){removePendingAnnotation();});
}

function removePendingAnnotation(){
  if(!pendingAnnotation)return;
  pendingAnnotation.form.remove();
  if(pendingAnnotation.marker)pendingAnnotation.marker.remove();
  if(pendingAnnotation.extra&&pendingAnnotation.extra.el)pendingAnnotation.extra.el.remove();
  pendingAnnotation=null;
}
`;
}