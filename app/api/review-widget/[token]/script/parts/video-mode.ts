// app/api/review-widget/[token]/script/parts/video-mode.ts

export function videoModeJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   VIDEO MODE  –  Record screen + optional mic, upload, post
   ══════════════════════════════════════════════════════════ */
var __avizVideoModal=null;
var __avizVideoRecorder=null;
var __avizVideoStreams=[];
var __avizVideoChunks=[];
var __avizVideoTimer=null;
var __avizVideoBlob=null;
var __avizVideoElapsed=0;
var __avizVideoMicOn=true;
var __avizVideoMimeType="video/webm";
var __avizVideoUrl=null;

var VIDEO_MAX_SECONDS=120;

function avizPickVideoMime(){
  var candidates=["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm","video/mp4"];
  for(var i=0;i<candidates.length;i++){
    if(typeof MediaRecorder!=="undefined"&&MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(candidates[i]))return candidates[i];
  }
  return "video/webm";
}

function avizFmtSeconds(sec){
  var m=Math.floor(sec/60)+"";
  var s=(Math.floor(sec%60)+"").length<2?"0"+Math.floor(sec%60):""+Math.floor(sec%60);
  return m+":"+s;
}

function avizStopVideoStreams(){
  for(var i=0;i<__avizVideoStreams.length;i++){
    var s=__avizVideoStreams[i];
    var tracks=s.getTracks();
    for(var j=0;j<tracks.length;j++)tracks[j].stop();
  }
  __avizVideoStreams=[];
}

function avizClearVideoTimer(){
  if(__avizVideoTimer){clearInterval(__avizVideoTimer);__avizVideoTimer=null;}
}

function avizCloseVideoModal(){
  avizClearVideoTimer();
  avizStopVideoStreams();
  if(__avizVideoRecorder&&__avizVideoRecorder.state!=="inactive"){
    try{__avizVideoRecorder.stop();}catch(e){}
  }
  __avizVideoRecorder=null;
  __avizVideoChunks=[];
  __avizVideoBlob=null;
  __avizVideoElapsed=0;
  if(__avizVideoUrl){try{URL.revokeObjectURL(__avizVideoUrl);}catch(e){}__avizVideoUrl=null;}
  if(__avizVideoModal){__avizVideoModal.remove();__avizVideoModal=null;}
}

function avizRenderVideoIdle(errMsg){
  if(!__avizVideoModal)return;
  var card=__avizVideoModal.querySelector(".aviz-vid-card-inner");
  card.innerHTML=''
    +'<p class="aviz-vid-copy">Share your screen (and your mic, if you want voice) for up to '+(VIDEO_MAX_SECONDS/60)+' minutes. Great for walking through something a screenshot can\\'t capture.</p>'
    +'<label class="aviz-vid-mic-toggle"><input type="checkbox" class="aviz-vid-mic-cb"'+(__avizVideoMicOn?' checked':'')+' /> Include microphone audio</label>'
    +(errMsg?'<p class="aviz-vid-err">'+esc(errMsg)+'</p>':'')
    +'<button class="aviz-vid-start">\\u25CF  Start recording</button>';
  card.querySelector(".aviz-vid-mic-cb").addEventListener("change",function(e){__avizVideoMicOn=!!e.target.checked;});
  card.querySelector(".aviz-vid-start").addEventListener("click",avizStartVideoRecording);
}

function avizRenderVideoRecording(){
  if(!__avizVideoModal)return;
  var card=__avizVideoModal.querySelector(".aviz-vid-card-inner");
  card.innerHTML=''
    +'<div class="aviz-vid-status"><span class="aviz-vid-dot"></span>Recording'+(__avizVideoMicOn?'':' (no mic)')+'<span class="aviz-vid-timer">'+avizFmtSeconds(__avizVideoElapsed)+' / '+avizFmtSeconds(VIDEO_MAX_SECONDS)+'</span></div>'
    +'<button class="aviz-vid-stop">\\u25A0  Stop recording</button>';
  card.querySelector(".aviz-vid-stop").addEventListener("click",avizStopVideoRecording);
}

function avizUpdateRecordingTimer(){
  if(!__avizVideoModal)return;
  var t=__avizVideoModal.querySelector(".aviz-vid-timer");
  if(t)t.textContent=avizFmtSeconds(__avizVideoElapsed)+" / "+avizFmtSeconds(VIDEO_MAX_SECONDS);
}

function avizRenderVideoPreview(){
  if(!__avizVideoModal)return;
  var card=__avizVideoModal.querySelector(".aviz-vid-card-inner");
  card.innerHTML=''
    +'<video class="aviz-vid-preview" src="'+esc(__avizVideoUrl)+'" controls></video>'
    +'<p class="aviz-vid-len">Length: '+avizFmtSeconds(__avizVideoElapsed)+'</p>'
    +'<div class="aviz-vid-actions">'
      +'<button class="aviz-vid-redo">\\u21BB  Record again</button>'
      +'<button class="aviz-vid-accept">Attach to comment  \\u2192</button>'
    +'</div>';
  card.querySelector(".aviz-vid-redo").addEventListener("click",function(){
    if(__avizVideoUrl){try{URL.revokeObjectURL(__avizVideoUrl);}catch(e){}__avizVideoUrl=null;}
    __avizVideoBlob=null;__avizVideoChunks=[];__avizVideoElapsed=0;
    avizRenderVideoIdle();
  });
  card.querySelector(".aviz-vid-accept").addEventListener("click",avizUploadAndCompose);
}

function avizRenderVideoUploading(){
  if(!__avizVideoModal)return;
  var card=__avizVideoModal.querySelector(".aviz-vid-card-inner");
  card.innerHTML='<div class="aviz-vid-uploading"><div class="aviz-vid-spinner"></div><p>Uploading your recording\\u2026</p></div>';
}

function avizStartVideoRecording(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getDisplayMedia){
    avizRenderVideoIdle("Your browser doesn't support screen recording.");
    return;
  }
  navigator.mediaDevices.getDisplayMedia({video:{frameRate:24},audio:true}).then(function(screen){
    __avizVideoStreams.push(screen);
    var maybeMic=__avizVideoMicOn
      ? navigator.mediaDevices.getUserMedia({audio:true}).then(function(m){__avizVideoStreams.push(m);return m;}).catch(function(){__avizVideoMicOn=false;return null;})
      : Promise.resolve(null);
    return maybeMic.then(function(mic){
      var tracks=[].concat(screen.getVideoTracks(),screen.getAudioTracks());
      if(mic)tracks=tracks.concat(mic.getAudioTracks());
      var combined=new MediaStream(tracks);
      __avizVideoMimeType=avizPickVideoMime();
      var rec=new MediaRecorder(combined,{mimeType:__avizVideoMimeType});
      __avizVideoRecorder=rec;__avizVideoChunks=[];
      rec.ondataavailable=function(e){if(e.data&&e.data.size>0)__avizVideoChunks.push(e.data);};
      rec.onstop=function(){
        var blob=new Blob(__avizVideoChunks,{type:__avizVideoMimeType});
        __avizVideoBlob=blob;
        __avizVideoUrl=URL.createObjectURL(blob);
        avizStopVideoStreams();
        avizRenderVideoPreview();
      };
      /* If user stops sharing from browser chrome, finalise cleanly */
      var vt=screen.getVideoTracks()[0];
      if(vt)vt.addEventListener("ended",avizStopVideoRecording);
      rec.start(500);
      __avizVideoElapsed=0;
      avizRenderVideoRecording();
      __avizVideoTimer=setInterval(function(){
        __avizVideoElapsed+=1;
        avizUpdateRecordingTimer();
        if(__avizVideoElapsed>=VIDEO_MAX_SECONDS)avizStopVideoRecording();
      },1000);
    });
  }).catch(function(err){
    avizStopVideoStreams();
    var msg=(err&&err.message)||"";
    if(msg.toLowerCase().indexOf("denied")!==-1||msg.toLowerCase().indexOf("permission")!==-1){
      avizRenderVideoIdle("Screen sharing was blocked. Allow the browser prompt and try again.");
    }else{
      avizRenderVideoIdle("Could not start recording. Your browser may not support screen capture.");
    }
  });
}

function avizStopVideoRecording(){
  avizClearVideoTimer();
  if(__avizVideoRecorder&&__avizVideoRecorder.state==="recording"){
    try{__avizVideoRecorder.stop();}catch(e){}
  }
}

function avizUploadAndCompose(){
  if(!__avizVideoBlob)return;
  avizRenderVideoUploading();
  uploadVideo(__avizVideoBlob,function(url){
    if(!url){avizRenderVideoPreview();return;}
    var videoUrl=url;
    /* Close the modal and open a simple comment form with the video attached. */
    avizCloseVideoModal();
    avizOpenVideoCommentForm(videoUrl);
  });
}

function avizOpenVideoCommentForm(videoUrl){
  /* Centre-screen form mirroring the style of pin/text forms but not anchored. */
  var wrap=document.createElement("div");
  wrap.className="aviz-pin-form aviz-video-form";
  wrap.style.top="50%";wrap.style.left="50%";wrap.style.transform="translate(-50%,-50%)";
  wrap.style.position="fixed";
  wrap.innerHTML=''
    +'<h4>Posting as <strong style="color:#374151;font-weight:600">'+esc(guestName)+'</strong></h4>'
    +'<video class="aviz-vid-preview" src="'+esc(videoUrl)+'" controls style="margin-bottom:12px"></video>'
    +'<textarea class="aviz-ta aviz-vf-text" placeholder="Add a comment to go with the video (optional)\\u2026" style="min-height:64px"></textarea>'
    +'<div class="aviz-pf-footer" style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;align-items:center">'
      +'<div class="aviz-pf-priority-slot" style="margin-right:auto"></div>'
      +'<button class="aviz-btn aviz-btn-g aviz-vf-cancel">Cancel</button>'
      +'<button class="aviz-btn aviz-btn-p aviz-vf-post">Post</button>'
    +'</div>';
  document.body.appendChild(wrap);
  var priorityCtrl=createPriorityControl();
  wrap.querySelector(".aviz-pf-priority-slot").appendChild(priorityCtrl.element);

  var ta=wrap.querySelector(".aviz-vf-text");
  var postBtn=wrap.querySelector(".aviz-vf-post");
  var cancelBtn=wrap.querySelector(".aviz-vf-cancel");
  ta.focus();

  function cleanup(){wrap.remove();}

  cancelBtn.addEventListener("click",cleanup);

  postBtn.addEventListener("click",function(){
    var text=ta.value.trim();
    postBtn.disabled=true;postBtn.textContent="Posting\\u2026";
    postComment({
      author_name:guestName,
      author_email:guestEmail||null,
      content:text||"[video comment]",
      comment_type:"general",
      video_url:videoUrl,
      priority:priorityCtrl.getValue()
    },function(d){
      cleanup();refresh();
      if(d)openPanel();
    });
  });

  ta.addEventListener("keydown",function(e){
    if(e.key==="Escape"){cleanup();}
    if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)){e.preventDefault();postBtn.click();}
  });
}

function openVideoRecorder(){
  if(__avizVideoModal)return;
  __avizVideoBlob=null;__avizVideoChunks=[];__avizVideoElapsed=0;
  if(__avizVideoUrl){try{URL.revokeObjectURL(__avizVideoUrl);}catch(e){}__avizVideoUrl=null;}

  var backdrop=document.createElement("div");
  backdrop.className="aviz-vid-backdrop";
  backdrop.innerHTML=''
    +'<div class="aviz-vid-card">'
      +'<div class="aviz-vid-head">'
        +'<h3>Record a video</h3>'
        +'<button class="aviz-vid-close" aria-label="Close">\\u00D7</button>'
      +'</div>'
      +'<div class="aviz-vid-card-inner"></div>'
    +'</div>';
  document.body.appendChild(backdrop);
  __avizVideoModal=backdrop;

  backdrop.querySelector(".aviz-vid-close").addEventListener("click",avizCloseVideoModal);
  backdrop.addEventListener("click",function(e){if(e.target===backdrop)avizCloseVideoModal();});

  avizRenderVideoIdle();
}
`;
}
