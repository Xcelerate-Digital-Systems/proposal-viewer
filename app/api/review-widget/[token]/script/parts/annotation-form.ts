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

  var fw=280,vw=window.innerWidth,vh=window.innerHeight;
  var cx=px-window.pageXOffset,cy=py-window.pageYOffset;
  var fx=px+20,fy=py-10;
  if(cx+fw+30>vw)fx=px-fw-20;
  if(cy+200+20>vh)fy=py-200+10;

  var f=document.createElement("div");f.className="aviz-pin-form";
  f.style.left=fx+"px";f.style.top=fy+"px";
  var typeLabel=type==="pin"?"Pin Comment":"Box Comment";
  f.innerHTML='<h4>'+typeLabel+'</h4>'
    +(guestName?'':'<input class="aviz-inp aviz-pf-name" placeholder="Your name" style="margin-bottom:6px"/>')
    +'<textarea class="aviz-ta aviz-pf-text" placeholder="Describe your feedback\\u2026" style="min-height:48px"></textarea>'
    +'<div style="display:flex;gap:6px;margin-top:10px;justify-content:flex-end">'
    +'<button class="aviz-btn aviz-btn-g aviz-pf-cancel">Cancel</button>'
    +'<button class="aviz-btn aviz-btn-p aviz-pf-send">Post</button></div>';
  document.body.appendChild(f);

  pendingAnnotation={form:f,marker:marker,type:type,x:px,y:py,extra:extra||null};

  var pfName=f.querySelector(".aviz-pf-name");
  var pfText=f.querySelector(".aviz-pf-text");
  var pfSend=f.querySelector(".aviz-pf-send");
  pfText.focus();

  pfSend.addEventListener("click",function(){
    var n=pfName?pfName.value.trim():guestName;
    var t=pfText.value.trim();
    if(!n||!t)return;
    guestName=n;saveGuest();
    pfSend.disabled=true;pfSend.textContent="Capturing\\u2026";

    /* Hide form + existing annotations, keep only pending marker/box visible */
    f.style.display="none";
    annotations.forEach(function(a){if(a.el)a.el.style.display="none";});

    captureAutoScreenshot(function(dataUrl){
      /* Restore existing annotations */
      annotations.forEach(function(a){if(a.el)a.el.style.display="";});
      pfSend.textContent="Uploading\\u2026";

      function doPost(ssUrl){
        var maxTn=0;comments.forEach(function(c){if(c.thread_number&&c.thread_number>maxTn)maxTn=c.thread_number;});
        var payload={
          author_name:n,content:t,comment_type:type,
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
    });
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