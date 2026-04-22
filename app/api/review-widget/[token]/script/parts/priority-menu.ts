// app/api/review-widget/[token]/script/parts/priority-menu.ts

export function priorityMenuJS(): string {
  return `
/* ══════════════════════════════════════════════════════════
   PRIORITY PICKER  –  shared across pin, text, highlight forms
   Returns { element, getValue() } — mount element wherever you
   need the button; call getValue() at submit time.
   ══════════════════════════════════════════════════════════ */
function createPriorityControl(){
  var state="none";

  var wrap=document.createElement("div");
  wrap.className="aviz-priority";

  var btn=document.createElement("button");
  btn.type="button";
  btn.className="aviz-priority-btn";
  btn.innerHTML=ICON.flag;
  btn.title="Set priority";
  wrap.appendChild(btn);

  var menu=document.createElement("div");
  menu.className="aviz-priority-menu";
  menu.innerHTML=
    '<div class="label">Set priority</div>'+
    '<button type="button" data-v="high"><span class="pi-high">'+ICON.alertCircle+'</span>High</button>'+
    '<button type="button" data-v="medium"><span class="pi-medium">'+ICON.circleMinus+'</span>Medium</button>'+
    '<button type="button" data-v="low"><span class="pi-low">'+ICON.circleArrowDown+'</span>Low</button>'+
    '<button type="button" data-v="none"><span class="pi-none">'+ICON.alertCircle+'</span>None</button>';
  wrap.appendChild(menu);

  function render(){
    btn.classList.remove("p-high","p-medium","p-low");
    if(state==="high")btn.classList.add("p-high");
    else if(state==="medium")btn.classList.add("p-medium");
    else if(state==="low")btn.classList.add("p-low");
    var buttons=menu.querySelectorAll("button");
    for(var i=0;i<buttons.length;i++){
      var b=buttons[i];
      if(b.getAttribute("data-v")===state)b.classList.add("selected");
      else b.classList.remove("selected");
    }
  }
  render();

  btn.addEventListener("click",function(e){
    e.stopPropagation();
    menu.classList.toggle("open");
  });
  menu.addEventListener("click",function(e){
    var target=e.target;
    var b=target&&target.closest?target.closest("button[data-v]"):null;
    if(!b)return;
    state=b.getAttribute("data-v")||"none";
    render();
    menu.classList.remove("open");
  });
  document.addEventListener("mousedown",function(e){
    if(!wrap.contains(e.target))menu.classList.remove("open");
  });

  return{
    element:wrap,
    getValue:function(){return state;}
  };
}
`;
}
