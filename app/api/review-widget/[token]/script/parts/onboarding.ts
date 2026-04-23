// app/api/review-widget/[token]/script/parts/onboarding.ts

export function onboardingJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   GUEST ONBOARDING MODAL
   First-visit prompt for reviewer name + optional email.
   ══════════════════════════════════════════════════════════ */
var onboardEl=null;
function showOnboard(onDone){
  if(onboardEl)return;
  onboardEl=document.createElement("div");onboardEl.id="aviz-onboard";
  onboardEl.innerHTML='<div class="aviz-onboard-card">'
    +'<span class="aviz-onboard-eyebrow">Feedback tool</span>'
    +'<h3>Leave feedback on this page</h3>'
    +'<p class="aviz-onboard-sub">You\\u2019ve been invited to review this page. Start by telling us who you are \\u2014 we\\u2019ll walk you through the feedback tools next.</p>'
    +'<div class="aviz-onboard-field"><label for="aviz-onboard-name">Your name</label>'
      +'<input id="aviz-onboard-name" type="text" autocomplete="name" placeholder="Jane Doe"/></div>'
    +'<div class="aviz-onboard-field"><label for="aviz-onboard-email">Email <span class="aviz-onboard-optional">(optional)</span></label>'
      +'<input id="aviz-onboard-email" type="email" autocomplete="email" placeholder="jane@example.com"/></div>'
    +'<p class="aviz-onboard-fine">Your email is only used to notify you when someone replies to your feedback.</p>'
    +'<button class="aviz-onboard-submit" disabled>Continue</button>'
    +'</div>';
  document.body.appendChild(onboardEl);

  var nameInp=onboardEl.querySelector("#aviz-onboard-name");
  var emailInp=onboardEl.querySelector("#aviz-onboard-email");
  var submit=onboardEl.querySelector(".aviz-onboard-submit");

  /* Pre-fill if we somehow already have a value (e.g. replay) */
  if(guestName)nameInp.value=guestName;
  if(guestEmail)emailInp.value=guestEmail;

  function validate(){
    submit.disabled=!nameInp.value.trim();
  }
  nameInp.addEventListener("input",validate);
  validate();
  setTimeout(function(){nameInp.focus();},30);

  function commit(){
    var n=nameInp.value.trim();
    if(!n)return;
    var em=emailInp.value.trim();
    /* Loose email validation — block only obvious typos. */
    if(em&&em.indexOf("@")<1){emailInp.style.borderColor="#ef4444";return;}
    guestName=n;guestEmail=em;saveGuest();
    closeOnboard();
    if(typeof onDone==="function"){onDone();return;}
    /* First-time flow: launch the guided tour after a short beat so the
       modal fade-out finishes before the backdrop appears. */
    if(typeof startTour==="function"){setTimeout(function(){startTour();},250);}
  }

  submit.addEventListener("click",commit);
  [nameInp,emailInp].forEach(function(el){
    el.addEventListener("keydown",function(ev){
      if(ev.key==="Enter"){ev.preventDefault();commit();}
    });
  });
}

function closeOnboard(){
  if(!onboardEl)return;
  onboardEl.remove();onboardEl=null;
}
`;
}
