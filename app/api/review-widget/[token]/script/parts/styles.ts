import { POPOVER_STYLE } from '@/lib/feedback/popover-style';

const DEFAULT_ACCENT = '#017C87';
const PIN_COLOR = '#22c55e'; // green-500 — consistent with in-app PinOverlay
const HOVER_COLOR = '#2563eb'; // blue-600 — markup.io-style element hover outline
const HIGHLIGHT_COLOR = '37,99,235'; // blue-600 rgb — text-highlight tint
const HIGHLIGHT_RING = '30,58,138'; // blue-900 rgb — pending highlight ring
const FONT = `'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`;

// Markup.io-style custom cursor: dark-blue circle with white crosshair.
// Inlined as data URI so it ships with the widget and works cross-origin.
const PIN_CURSOR_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><circle cx='16' cy='16' r='12' fill='%232563eb' stroke='%23ffffff' stroke-width='2'/><line x1='16' y1='9' x2='16' y2='23' stroke='%23ffffff' stroke-width='2' stroke-linecap='round'/><line x1='9' y1='16' x2='23' y2='16' stroke='%23ffffff' stroke-width='2' stroke-linecap='round'/></svg>`;
const PIN_CURSOR = `url("data:image/svg+xml;utf8,${PIN_CURSOR_SVG}") 16 16, crosshair`;

/** Per-agency accent threaded in from the route; falls back to AgencyViz
 *  teal so unbranded companies still look on-brand. */
export function stylesJS(_apiBase: string, accentColor: string = DEFAULT_ACCENT): string {
  const ACCENT = accentColor;
  return `
// Load Outfit from Google Fonts (widget runs on third-party pages)
var fontLink=document.createElement("link");
fontLink.rel="stylesheet";
fontLink.href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap";
document.head.appendChild(fontLink);

var sty=document.createElement("style");
sty.textContent=\`
#aviz-root{box-sizing:border-box;margin:0;padding:0;font-family:${FONT};line-height:1.45;}
#aviz-root *{box-sizing:border-box;font-family:${FONT};line-height:1.45;}

/* ── Per-mode cursor (matches the active tool) ───────────
   Apply mode cursor to every element under html, then explicitly reset
   inside the widget chrome. The old form relied on CSS Selectors L4
   complex-:not() support and was leaking the crosshair onto the toolbar
   in some browsers — the override below is bullet-proof regardless of
   L4 support. Browse mode intentionally has no cursor rule, so the
   host page's native cursors come back. */
html.aviz-mode-pin *,html.aviz-mode-box *{cursor:${PIN_CURSOR} !important;}
html.aviz-mode-text *,html.aviz-mode-highlight *{cursor:text !important;}

/* Force-reset cursor inside any widget-owned chrome so the mode cursor
   never bleeds in. Specific interactive elements re-declare cursor:pointer
   / cursor:text below with !important to win against this reset. */
#aviz-root,#aviz-root *,#aviz-onboard,#aviz-onboard *,#aviz-tour-backdrop,#aviz-tour-backdrop *,.aviz-tour-callout,.aviz-tour-callout *,#aviz-hover-box,.aviz-pin-form,.aviz-pin-form *,.aviz-text-input,.aviz-text-input *{cursor:auto !important;}
/* Restore explicit cursors on interactive widget elements. */
.aviz-tool,#aviz-root button,#aviz-root [role="button"],#aviz-root a,.aviz-pin,.aviz-hl-badge,.aviz-priority-btn,#aviz-bar-cancel,.aviz-pf-cancel,.aviz-pf-send{cursor:pointer !important;}
#aviz-root input,#aviz-root textarea,#aviz-root [contenteditable="true"],.aviz-pin-form textarea,.aviz-pin-form input,.aviz-text-input{cursor:text !important;}

/* ── Element hover highlight (single floating overlay — markup.io-style)
   A single fixed-position box transitions between hovered elements via
   transform/width/height, which animates smoothly instead of snapping. */
#aviz-hover-box{position:absolute;top:0;left:0;pointer-events:none;z-index:2147483637;
  border:3px solid ${HOVER_COLOR};border-radius:6px;background:${HOVER_COLOR}14;
  opacity:0;
  transition:transform .22s cubic-bezier(.4,0,.2,1),width .22s cubic-bezier(.4,0,.2,1),height .22s cubic-bezier(.4,0,.2,1),opacity .15s ease-out;
  will-change:transform,width,height;}
#aviz-hover-box.show{opacity:1;}

/* ── Pin marker ────────────────────────────────────────── */
/* !important throughout this section — host pages frequently reset div
   backgrounds, borders, and box-shadows, which silently makes the pending
   marker invisible while the comment form is open. */
.aviz-pin{position:absolute !important;z-index:2147483639 !important;width:34px !important;height:34px !important;border-radius:50% !important;
  background:${PIN_COLOR} !important;color:#fff !important;font-size:15px !important;font-weight:700 !important;display:flex !important;align-items:center !important;
  justify-content:center !important;cursor:pointer;transform:translate(-50%,-50%) !important;
  box-shadow:0 2px 8px rgba(0,0,0,.25) !important;border:2px solid #fff !important;
  transition:transform .3s,box-shadow .3s;font-family:${FONT};line-height:1;}
.aviz-pin:hover{transform:translate(-50%,-50%) scale(1.15) !important;box-shadow:0 4px 12px rgba(0,0,0,.3) !important;}
.aviz-pin.pending{animation:aviz-pinPulse .8s ease-in-out infinite alternate;}
@keyframes aviz-pinPulse{from{box-shadow:0 2px 8px rgba(0,0,0,.25);}to{box-shadow:0 2px 16px ${PIN_COLOR}60;}}
/* Resolved pin — greyed out so reviewers can see at a glance what's done.
   Still clickable (drops the user into the resolved thread in the panel). */
.aviz-pin.resolved{background:#9ca3af !important;opacity:.55;animation:none !important;}
.aviz-pin.resolved:hover{opacity:.9;}
/* Brief pulse when the panel scrolls the viewport to this pin (Issue 3). */
.aviz-pin.aviz-pin-focus{animation:aviz-pinFocus 1.6s ease-out 1;}
@keyframes aviz-pinFocus{0%{box-shadow:0 0 0 0 ${PIN_COLOR}cc;}100%{box-shadow:0 0 0 22px ${PIN_COLOR}00;}}

/* ── Box drawing ───────────────────────────────────────── */
.aviz-draw-box{position:absolute !important;z-index:2147483639 !important;border:2px dashed ${ACCENT} !important;background:${ACCENT}10 !important;pointer-events:none !important;}
.aviz-box{position:absolute !important;z-index:2147483639 !important;border:2px solid ${ACCENT} !important;background:${ACCENT}08 !important;cursor:pointer;transition:opacity .3s;}
.aviz-box:hover{background:${ACCENT}15 !important;}
.aviz-box.pending{animation:aviz-boxPulse .8s ease-in-out infinite alternate;}
@keyframes aviz-boxPulse{from{border-color:${ACCENT};}to{border-color:${ACCENT}80;}}
.aviz-box.resolved{border-color:#9ca3af !important;background:rgba(156,163,175,.06) !important;opacity:.55;animation:none !important;}
.aviz-box.resolved:hover{opacity:.9;}

/* ── Text annotation input ─────────────────────────────── */
.aviz-text-input{position:absolute;z-index:2147483639;min-width:120px;padding:6px 10px;
  border:2px solid ${ACCENT};border-radius:6px;background:#fff;font-size:13px;color:#111;
  outline:none;box-shadow:0 2px 8px rgba(0,0,0,.15);font-family:${FONT};}
.aviz-text-ann{position:absolute;z-index:2147483639;padding:4px 8px;background:${ACCENT};
  color:#fff;font-size:12px;font-weight:500;border-radius:4px;cursor:pointer;
  white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.2);transition:opacity .3s;}
.aviz-text-ann:hover{opacity:.85;}
.aviz-text-ann.resolved{background:#9ca3af !important;opacity:.55;}
.aviz-text-ann.resolved:hover{opacity:.9;}

/* ── Text mode: inline comment form ────────────────────── */
.aviz-text-input-wrap{position:absolute;z-index:2147483643;width:300px;background:#fff;border-radius:12px;
  box-shadow:0 8px 40px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.06);padding:14px;
  animation:aviz-fadeIn .15s ease-out;}

/* ── Stack (mode toggle + toolbar) ─────────────────────────
   The fixed right-edge anchor lives on the stack so the toggle pill
   and the toolbar stay vertically aligned and slide off together on
   mobile when the comments panel opens. */
#aviz-stack{position:fixed;right:20px;top:50%;transform:translateY(-50%);z-index:2147483640;
  display:flex;flex-direction:column;align-items:flex-end;gap:10px;
  transition:right .25s cubic-bezier(.4,0,.2,1);}

/* ── Mode toggle (Comment / Browse) ────────────────────────
   Floating segmented pill control anchored to the bottom-centre of
   the viewport, independent of the right-edge toolbar stack so it
   doesn't read as a sub-control of the toolbar. The lit pill is the
   reviewer's current mode; the unlit pill is a one-click switch. */
#aviz-mode-toggle{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483640;
  display:inline-flex;background:#fff;border-radius:9999px;padding:5px;gap:2px;
  border:1px solid rgba(0,0,0,.04);
  box-shadow:0 2px 4px rgba(20,20,40,.06),0 10px 30px rgba(20,20,40,.12);
  transition:bottom .25s cubic-bezier(.4,0,.2,1),opacity .2s;}
.aviz-toggle-pill{background:transparent;border:none;color:#6b7280;font-family:${FONT};
  font-size:13px;font-weight:600;letter-spacing:.01em;padding:8px 18px;border-radius:9999px;
  cursor:pointer;line-height:1;margin:0;transition:background-color .2s,color .2s;}
.aviz-toggle-pill:hover{color:#111827;}
.aviz-toggle-pill.active,.aviz-toggle-pill.active:hover{background:${ACCENT};color:#fff;
  box-shadow:0 1px 2px rgba(20,20,40,.06);}

/* ── Toolbar ───────────────────────────────────────────────
   Mirrors the in-app FeedbackToolbar component: rounded card, small
   pill buttons individually rounded, full accent fill when active,
   dark pill tooltip on hover, light centred separator. */
#aviz-toolbar{display:flex;flex-direction:column;align-items:center;gap:4px;background:#fff;border-radius:16px;
  box-shadow:0 2px 4px rgba(20,20,40,.06),0 8px 24px rgba(20,20,40,.06);
  padding:6px;overflow:visible;border:1px solid rgba(0,0,0,.04);}
.aviz-tool{position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;
  background:transparent;border:none;border-radius:12px;cursor:pointer;color:#6b7280;
  transition:background-color .2s,color .2s;margin:0;padding:0;}
.aviz-tool svg{width:18px;height:18px;display:block;}
.aviz-tool:hover{background:#f9fafb;color:#111827;}
.aviz-tool.active{background:${ACCENT} !important;color:#fff !important;
  box-shadow:0 1px 2px rgba(20,20,40,.06);}
.aviz-tool.active:hover{background:${ACCENT} !important;color:#fff !important;}
.aviz-tool .aviz-badge{position:absolute;top:-2px;right:-2px;min-width:16px;height:16px;border-radius:9999px;
  background:${ACCENT};color:#fff;font-size:9px;font-weight:600;display:flex;align-items:center;
  justify-content:center;padding:0 4px;line-height:1;}
.aviz-tool.active .aviz-badge{background:#fff;color:${ACCENT};}
.aviz-tool .aviz-badge:empty{display:none;}
.aviz-tooltip{position:absolute;right:calc(100% + 8px);top:50%;transform:translateY(-50%);
  background:#111827;color:#fff;font-size:11px;font-weight:500;padding:5px 10px;border-radius:8px;
  white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .2s;z-index:2147483641;
  box-shadow:0 2px 6px rgba(0,0,0,.12);}
.aviz-tool:hover .aviz-tooltip{opacity:1;}
.aviz-tooltip .soon{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:9999px;
  background:rgba(255,255,255,.18);color:#fff;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;}
.aviz-sep{width:20px;height:1px;background:#f3f4f6;flex-shrink:0;margin:2px 0;padding:0;}
/* Toolbar lives on the right; panel lives on the left — no shift needed on desktop. */
@media(max-width:480px){
  #aviz-stack{right:10px;gap:8px;}
  #aviz-toolbar{padding:5px;}
  .aviz-tool{width:34px;height:34px;}
  #aviz-mode-toggle{bottom:14px;}
  .aviz-toggle-pill{padding:7px 14px;font-size:12.5px;}
  /* Panel covers the viewport on mobile; tuck the toolbar off the right
     edge and slide the floating toggle off the bottom so neither sit on
     top of the panel. */
  #aviz-stack.panel-open{right:-160px;}
  #aviz-mode-toggle.panel-open{bottom:-80px;opacity:0;pointer-events:none;}
}

/* ── Mode bar (top bar when pin/box/text active) ───────── */
#aviz-bar{position:fixed;top:0;left:0;right:0;z-index:2147483642;background:${ACCENT};
  color:#fff;display:none;align-items:center;justify-content:center;gap:12px;padding:10px 16px;
  font-size:13px;font-weight:500;box-shadow:0 2px 12px rgba(0,0,0,.15);}
#aviz-bar.show{display:flex;}
#aviz-bar button{background:rgba(255,255,255,.2);color:#fff;border:none;border-radius:6px;
  padding:5px 14px;font-size:12px;cursor:pointer;font-weight:500;font-family:${FONT};transition:background .3s;margin:0;}
#aviz-bar button:hover{background:rgba(255,255,255,.3);}

/* ── Annotation form (floating card — matches in-app PendingPinPopover) ── */
.aviz-pin-form{position:absolute;z-index:2147483643;width:${POPOVER_STYLE.widthPx}px;max-width:calc(100vw - 40px);background:${POPOVER_STYLE.background};border-radius:16px;
  box-shadow:${POPOVER_STYLE.boxShadow};padding:0;border:1px solid ${POPOVER_STYLE.borderColor};
  animation:aviz-fadeIn .15s ease-out;display:flex;flex-direction:column;
  font-family:${FONT} !important;line-height:1.45 !important;color:#111827;font-style:normal;}
.aviz-pin-form *{font-family:${FONT} !important;line-height:1.45 !important;box-sizing:border-box;}
@keyframes aviz-fadeIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
.aviz-pf-body{padding:16px 16px 8px;display:flex;flex-direction:column;}
.aviz-pin-form h4{font-size:11px;font-weight:500;color:#9ca3af;margin:0 0 6px 0;padding:0;font-style:normal;text-transform:none;letter-spacing:normal;}
.aviz-pin-form h4 strong{font-weight:600;color:#4b5563;}
.aviz-pin-form textarea,.aviz-pin-form input{font-family:${FONT} !important;color:#111827;}
.aviz-pin-form .aviz-pf-text{width:100%;border:none !important;background:transparent !important;padding:0 !important;font-size:14px;color:#111827;outline:none;resize:none;min-height:72px;box-shadow:none !important;}
.aviz-pin-form .aviz-pf-text::placeholder{color:#9ca3af;}
.aviz-pf-quote{margin:0 0 10px 0;padding:6px 10px;border-left:3px solid #fde047;background:#fefce8;border-radius:0 6px 6px 0;font-size:11px;color:#92400e;font-style:italic;}
.aviz-pf-footer{display:flex;align-items:center;gap:6px;padding:8px 12px;border-top:1px solid #f3f4f6;}
.aviz-pf-footer .aviz-pf-priority-slot{display:inline-flex;align-items:center;}
.aviz-pf-footer .aviz-pf-spacer{flex:1;}
.aviz-pin-form .aviz-pf-cancel{font-size:13px;padding:6px 10px;color:#9ca3af;background:none;border:none;cursor:pointer;border-radius:6px;font-weight:500;transition:color .2s,background .2s;}
.aviz-pin-form .aviz-pf-cancel:hover{color:#6b7280;background:#f9fafb;}
.aviz-pin-form .aviz-pf-send{display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border-radius:9999px;background:${ACCENT};color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer;transition:background .2s,opacity .2s;}
.aviz-pin-form .aviz-pf-send:hover:not(:disabled){background:#015f68;}
.aviz-pin-form .aviz-pf-send:disabled{opacity:.4;cursor:not-allowed;}

/* ── Text highlight marks ──────────────────────────────────
   !important is required because many host pages style <mark>
   themselves (or reset background/color), which would otherwise
   make the pending highlight invisible. */
mark.aviz-hl,mark.aviz-hl-pending{display:inline !important;padding:1px 2px !important;border-radius:2px !important;color:inherit !important;font:inherit !important;text-decoration:none !important;}
mark.aviz-hl{background:rgba(${HIGHLIGHT_COLOR},.28) !important;cursor:pointer;transition:background .3s;}
mark.aviz-hl-pending{background:rgba(${HIGHLIGHT_COLOR},.45) !important;box-shadow:0 0 0 1px rgba(${HIGHLIGHT_RING},.55) !important;}
mark.aviz-hl:hover{background:rgba(${HIGHLIGHT_COLOR},.4) !important;}
mark.aviz-hl.resolved{background:rgba(${HIGHLIGHT_COLOR},.15) !important;}
.aviz-hl-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;margin:0 3px;border-radius:9999px;background:${PIN_COLOR};color:#fff;font-size:10px;font-weight:700;line-height:1;vertical-align:middle;cursor:pointer;user-select:none;font-style:normal;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.2);font-family:${FONT};}

/* ── Priority selector (shared across pin, text, highlight forms) ── */
.aviz-priority{position:relative;display:inline-flex;}
.aviz-priority-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;background:transparent;border:none;color:#9ca3af;cursor:pointer;padding:0;margin:0;transition:background .3s,color .3s;}
.aviz-priority-btn:hover{background:#f3f4f6;color:#6b7280;}
.aviz-priority-btn.p-high{color:#ef4444;}
.aviz-priority-btn.p-medium{color:#f59e0b;}
.aviz-priority-btn.p-low{color:#10b981;}
.aviz-priority-menu{position:absolute;right:0;bottom:calc(100% + 4px);background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,.12);padding:4px 0;min-width:160px;z-index:2147483645;display:none;font-family:${FONT};}
.aviz-priority-menu.open{display:block;}
.aviz-priority-menu .label{padding:6px 12px 4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#9ca3af;}
.aviz-priority-menu button{display:flex;align-items:center;gap:8px;width:100%;padding:6px 12px;border:none;background:transparent;color:#374151;font-size:13px;font-family:inherit;cursor:pointer;text-align:left;}
.aviz-priority-menu button:hover{background:#f9fafb;}
.aviz-priority-menu button.selected{color:#2563eb;font-weight:600;}
.aviz-priority-menu .pi-high{color:#ef4444;}
.aviz-priority-menu .pi-medium{color:#f59e0b;}
.aviz-priority-menu .pi-low{color:#10b981;}
.aviz-priority-menu .pi-none{color:#2563eb;}

/* ── Video recorder modal ──────────────────────────────── */
.aviz-vid-backdrop{position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,.6);display:flex;align-items:center;justify-content:center;padding:20px;font-family:${FONT};}
.aviz-vid-card{background:#fff;border-radius:16px;width:100%;max-width:540px;box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden;animation:aviz-fadeIn .2s ease-out;}
.aviz-vid-head{display:flex;align-items:center;justify-content:space-between;padding:18px 22px 6px;}
.aviz-vid-head h3{margin:0;padding:0;font-size:17px;font-weight:600;color:#111;font-family:${FONT};}
.aviz-vid-close{background:transparent;border:none;color:#9ca3af;font-size:22px;line-height:1;cursor:pointer;padding:4px 8px;margin:0;border-radius:6px;}
.aviz-vid-close:hover{background:#f3f4f6;color:#6b7280;}
.aviz-vid-card-inner{padding:10px 22px 20px;display:flex;flex-direction:column;gap:14px;}
.aviz-vid-copy{margin:0;padding:0;font-size:13px;color:#6b7280;line-height:1.55;}
.aviz-vid-mic-toggle{display:flex;align-items:center;gap:8px;font-size:13px;color:#374151;cursor:pointer;user-select:none;}
.aviz-vid-mic-toggle input{width:16px;height:16px;margin:0;padding:0;}
.aviz-vid-err{margin:0;padding:0;font-size:12px;color:#dc2626;}
.aviz-vid-start{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 18px;border:none;border-radius:12px;background:#ef4444;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:${FONT};transition:background .3s;}
.aviz-vid-start:hover{background:#dc2626;}
.aviz-vid-status{display:flex;align-items:center;gap:8px;padding:12px 14px;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:13px;font-weight:500;}
.aviz-vid-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;animation:aviz-pulse 1s ease-in-out infinite;}
@keyframes aviz-pulse{0%,100%{opacity:1}50%{opacity:.4}}
.aviz-vid-timer{margin-left:auto;font-family:ui-monospace,Menlo,Monaco,monospace;font-size:13px;color:#991b1b;}
.aviz-vid-stop{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 18px;border:none;border-radius:12px;background:#111827;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:${FONT};transition:background .3s;}
.aviz-vid-stop:hover{background:#1f2937;}
.aviz-vid-preview{width:100%;max-height:380px;border-radius:12px;background:#000;display:block;}
.aviz-vid-len{margin:0;padding:0;text-align:center;font-size:11px;color:#9ca3af;}
.aviz-vid-actions{display:flex;gap:8px;}
.aviz-vid-redo{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;color:#374151;font-size:13px;font-weight:600;cursor:pointer;font-family:${FONT};}
.aviz-vid-redo:hover{background:#f9fafb;}
.aviz-vid-accept{flex:1.4;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 14px;border:none;border-radius:12px;background:${ACCENT};color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:${FONT};transition:background .3s;}
.aviz-vid-accept:hover{background:#015f68;}
.aviz-vid-uploading{padding:40px 0;display:flex;flex-direction:column;align-items:center;gap:12px;}
.aviz-vid-uploading p{margin:0;padding:0;font-size:13px;color:#6b7280;}
.aviz-vid-spinner{width:32px;height:32px;border-radius:50%;border:2px solid #e5e7eb;border-top-color:${ACCENT};animation:aviz-spin 1s linear infinite;}
@keyframes aviz-spin{to{transform:rotate(360deg)}}

/* Inline video card (panel + video comment composer) */
.aviz-card-video{display:block;width:100%;max-width:100%;border-radius:10px;background:#000;margin:8px 0;max-height:260px;}
.aviz-video-form{max-width:460px;}

/* ── Guest onboarding modal ───────────────────────────── */
#aviz-onboard{position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,.55);
  display:flex;align-items:center;justify-content:center;padding:20px;
  animation:aviz-fadeIn .2s ease-out;}
#aviz-onboard .aviz-onboard-card{width:100%;max-width:400px;background:#fff;border-radius:16px;
  box-shadow:0 20px 60px rgba(0,0,0,.25);padding:24px;font-family:${FONT};}
#aviz-onboard .aviz-onboard-eyebrow{display:inline-block;font-size:10px;font-weight:600;color:${ACCENT};
  text-transform:uppercase;letter-spacing:.5px;background:${ACCENT}14;padding:3px 8px;border-radius:6px;
  margin:0 0 10px 0;font-family:${FONT};}
#aviz-onboard h3{font-size:19px;font-weight:600;color:#111;margin:0 0 8px 0;padding:0;font-family:${FONT};line-height:1.3;}
#aviz-onboard p.aviz-onboard-sub{font-size:13px;color:#6b7280;margin:0 0 18px 0;padding:0;line-height:1.55;}
#aviz-onboard p.aviz-onboard-fine{font-size:11px;color:#9ca3af;margin:-6px 0 14px 0;padding:0;line-height:1.5;}
#aviz-onboard label{display:block;font-size:11px;font-weight:500;color:#6b7280;margin:0 0 4px 0;padding:0;text-transform:uppercase;letter-spacing:.3px;}
#aviz-onboard .aviz-onboard-field{margin:0 0 12px 0;padding:0;}
#aviz-onboard .aviz-onboard-field:last-of-type{margin-bottom:18px;}
#aviz-onboard input{width:100%;padding:10px 12px;margin:0;border:1px solid #e5e7eb;border-radius:8px;
  font-size:14px;color:#111;outline:none;background:#fff;font-family:${FONT};
  transition:border-color .15s,box-shadow .15s;}
#aviz-onboard input:focus{border-color:${ACCENT};box-shadow:0 0 0 3px ${ACCENT}20;}
#aviz-onboard .aviz-onboard-submit{width:100%;padding:11px 18px;margin:0;border-radius:10px;
  background:${ACCENT};color:#fff;font-size:14px;font-weight:600;border:none;cursor:pointer;
  font-family:${FONT};transition:background .3s;}
#aviz-onboard .aviz-onboard-submit:hover:not(:disabled){background:#015f68;}
#aviz-onboard .aviz-onboard-submit:disabled{opacity:.5;cursor:not-allowed;}
#aviz-onboard .aviz-onboard-optional{font-size:10px;color:#9ca3af;font-weight:400;text-transform:none;letter-spacing:0;margin-left:4px;}

/* ── Guided tour (first-visit walkthrough of toolbar) ──── */
#aviz-tour-backdrop{position:fixed;inset:0;z-index:2147483635;background:rgba(15,23,42,.55);
  animation:aviz-fadeIn .2s ease-out;}
html.aviz-tour-on #aviz-stack{pointer-events:none;z-index:2147483640;}
html.aviz-tour-on #aviz-mode-toggle{opacity:.45;pointer-events:none;}
html.aviz-tour-on .aviz-tool .aviz-tooltip{display:none;}
html.aviz-tour-on .aviz-tool.aviz-tour-target{background:${ACCENT}18;color:${ACCENT};
  box-shadow:0 0 0 3px ${ACCENT}55,0 0 22px ${ACCENT}99;animation:aviz-tourPulse 1.5s ease-in-out infinite;position:relative;z-index:1;}
@keyframes aviz-tourPulse{
  0%,100%{box-shadow:0 0 0 3px ${ACCENT}55,0 0 22px ${ACCENT}99;}
  50%{box-shadow:0 0 0 7px ${ACCENT}2e,0 0 34px ${ACCENT};}
}
.aviz-tour-callout{position:fixed;z-index:2147483647;width:280px;max-width:calc(100vw - 32px);
  background:#fff;border-radius:14px;padding:16px 18px;font-family:${FONT};
  box-shadow:0 20px 60px rgba(0,0,0,.28),0 2px 6px rgba(0,0,0,.08);
  animation:aviz-fadeIn .2s ease-out;}
.aviz-tour-callout .aviz-tour-step{font-size:10px;font-weight:600;color:${ACCENT};
  text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px 0;padding:0;}
.aviz-tour-callout h4{font-size:15px;font-weight:600;color:#111;margin:0 0 6px 0;padding:0;
  font-family:${FONT};line-height:1.3;}
.aviz-tour-callout p{font-size:13px;color:#4b5563;line-height:1.55;margin:0 0 14px 0;padding:0;}
.aviz-tour-callout .aviz-tour-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0;padding:0;}
.aviz-tour-callout .aviz-tour-skip{background:none;border:none;color:#9ca3af;font-size:12px;
  font-weight:500;padding:6px 8px;margin:0;cursor:pointer;font-family:${FONT};border-radius:6px;
  transition:color .3s,background .3s;}
.aviz-tour-callout .aviz-tour-skip:hover{color:#6b7280;background:#f3f4f6;}
.aviz-tour-callout .aviz-tour-next{background:${ACCENT};color:#fff;border:none;padding:8px 18px;
  margin:0;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:${FONT};
  transition:background .3s;}
.aviz-tour-callout .aviz-tour-next:hover{background:#015f68;}
.aviz-tour-callout .aviz-tour-arrow{position:absolute;right:-7px;top:50%;transform:translateY(-50%);
  width:14px;height:14px;background:#fff;border-right:1px solid rgba(0,0,0,.04);
  border-top:1px solid rgba(0,0,0,.04);transform-origin:center;rotate:45deg;
  box-shadow:2px -2px 4px rgba(0,0,0,.04);}
.aviz-tour-callout.flipped .aviz-tour-arrow{right:auto;left:-7px;rotate:225deg;}

/* ══════════════════════════════════════════════════════════
   COMMENTS PANEL  –  matches in-app CommentsPanel design
   ══════════════════════════════════════════════════════════ */
#aviz-panel{position:fixed;top:0;left:0;bottom:0;z-index:2147483641;width:340px;
  background:#FBF8F5;border-right:1px solid #ece6df;
  box-shadow:4px 0 24px rgba(0,0,0,.06);display:flex;flex-direction:column;
  transform:translateX(-100%);transition:transform .25s cubic-bezier(.4,0,.2,1);pointer-events:none;}
#aviz-panel.open{transform:translateX(0);pointer-events:all;}
@media(max-width:480px){#aviz-panel{width:calc(100vw - 16px);}}

/* ── Panel header ──────────────────────────────────────── */
#aviz-panel .aviz-ph{padding:20px 20px 12px;margin:0;display:flex;align-items:flex-start;justify-content:space-between;flex-shrink:0;}
#aviz-panel .aviz-ph-left{display:flex;flex-direction:column;align-items:flex-start;gap:0;margin:0;padding:0;}
#aviz-panel .aviz-ph-title{font-size:16px;font-weight:600;color:#111827;margin:0;padding:0;letter-spacing:-.01em;}
#aviz-panel .aviz-ph-sub{font-size:11px;color:#9ca3af;margin:2px 0 0 0;padding:0;}
#aviz-panel .aviz-ph-close{width:24px;height:24px;border-radius:6px;border:none;background:transparent;color:#9ca3af;
  cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;margin:0;padding:0;}
#aviz-panel .aviz-ph-close:hover{color:#6b7280;}

/* ── Body ──────────────────────────────────────────────── */
#aviz-panel .aviz-pb{flex:1;overflow-y:auto;padding:0 16px 16px;margin:0;display:flex;flex-direction:column;gap:12px;}
#aviz-panel .aviz-pb::-webkit-scrollbar{width:4px;}
#aviz-panel .aviz-pb::-webkit-scrollbar-track{background:transparent;}
#aviz-panel .aviz-pb::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:2px;}

/* ══════════════════════════════════════════════════════════
   THREAD CARD  –  matches in-app CommentThread (rounded card)
   ══════════════════════════════════════════════════════════ */
#aviz-panel .aviz-card{background:#fff;border-radius:16px;padding:16px 20px;margin:0;
  box-shadow:0 1px 2px rgba(20,20,40,0.04),0 4px 16px rgba(20,20,40,0.03);
  transition:box-shadow .3s, outline-color .3s;outline:2px solid transparent;outline-offset:2px;}
#aviz-panel .aviz-card.highlight{outline-color:${ACCENT};}

/* Pin badge row (thread number) */
#aviz-panel .aviz-card-pinbadge{display:flex;align-items:center;gap:8px;margin:0 0 12px 0;padding:0;}
#aviz-panel .aviz-card-pinbadge-num{width:24px;height:24px;border-radius:9999px;background:#d1fae5;color:#047857;
  display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;line-height:1;}
#aviz-panel .aviz-card-pinbadge-label{font-size:11px;color:#9ca3af;margin:0;padding:0;}

/* Author row: avatar + name + badges + time */
#aviz-panel .aviz-card-row{display:flex;align-items:flex-start;gap:12px;margin:0;padding:0;}
#aviz-panel .aviz-avatar{width:32px;height:32px;border-radius:9999px;display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:600;flex-shrink:0;background:${ACCENT}1a;color:${ACCENT};line-height:1;}
#aviz-panel .aviz-avatar.guest{background:#ede9fe;color:#6d28d9;}
/* Photo variant — same circle, but the <img> fills it. Override the bubble
   background/colour so we don't get a tint behind transparent PNGs. Listed
   with every avatar class so it beats their #aviz-panel-prefixed defaults
   regardless of cascade order. */
#aviz-panel .aviz-avatar.aviz-avatar-img,
#aviz-panel .aviz-card-reply-avatar.aviz-avatar-img,
#aviz-panel .aviz-resolved-avatar.aviz-avatar-img{
  display:block;object-fit:cover;background:#f3f4f6;border:1px solid rgba(0,0,0,.04);color:transparent;
}
#aviz-panel .aviz-card-main{flex:1;min-width:0;}
#aviz-panel .aviz-card-meta-row{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin:0;padding:0;}
#aviz-panel .aviz-card-author{font-size:14px;font-weight:500;color:#111827;margin:0;padding:0;line-height:1.3;}
#aviz-panel .aviz-card-team{font-size:10px;font-weight:500;padding:1px 8px;margin:0;border-radius:9999px;
  background:${ACCENT}1a;color:${ACCENT};line-height:1.4;}
#aviz-panel .aviz-card-team.sm{font-size:9px;padding:1px 6px;}
#aviz-panel .aviz-card-priority{display:inline-flex;align-items:center;gap:3px;padding:1px 8px;margin:0;border-radius:9999px;
  font-size:11px;font-weight:500;line-height:1.4;}
#aviz-panel .aviz-card-priority.p-high{background:#fee2e2;color:#b91c1c;}
#aviz-panel .aviz-card-priority.p-medium{background:#fef3c7;color:#b45309;}
#aviz-panel .aviz-card-priority.p-low{background:#d1fae5;color:#047857;}
#aviz-panel .aviz-card-time{font-size:11px;color:#9ca3af;margin:0;padding:0;}

/* Highlight quote (for text_highlight comments) */
#aviz-panel .aviz-card-quote{margin:6px 0 0 0;padding:6px 10px;border-radius:8px;background:${ACCENT}0d;}
#aviz-panel .aviz-card-quote p{margin:0;padding:0;font-size:11px;color:${ACCENT};font-style:italic;line-height:1.4;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}

/* Card content */
#aviz-panel .aviz-card-content{font-size:13px;color:#374151;line-height:1.6;white-space:pre-wrap;word-break:break-word;
  margin:4px 0 0 0;padding:0;}

/* Screenshot thumbnail meta */
#aviz-panel .aviz-card-screenshot{display:flex;align-items:flex-start;gap:10px;margin:10px 0 0 0;padding:8px;
  border-radius:10px;background:#f9fafb;}
#aviz-panel .aviz-card-thumb{width:56px;height:42px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;
  cursor:pointer;flex-shrink:0;transition:opacity .2s;margin:0;padding:0;}
#aviz-panel .aviz-card-thumb:hover{opacity:.8;}
#aviz-panel .aviz-card-screenshot-info{display:flex;flex-direction:column;gap:2px;min-width:0;margin:0;padding:0;}
#aviz-panel .aviz-card-screenshot-row{font-size:10px;color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0;padding:0;}

/* Replies (indented) */
#aviz-panel .aviz-card-replies{margin:12px 0 0 44px;padding:0;display:flex;flex-direction:column;gap:12px;}
#aviz-panel .aviz-card-reply{margin:0;padding:0;}
#aviz-panel .aviz-card-reply-row{display:flex;align-items:flex-start;gap:8px;margin:0;padding:0;}
#aviz-panel .aviz-card-reply-avatar{width:24px;height:24px;border-radius:9999px;display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:600;flex-shrink:0;background:${ACCENT}1a;color:${ACCENT};line-height:1;}
#aviz-panel .aviz-card-reply-avatar.guest{background:#ede9fe;color:#6d28d9;}
#aviz-panel .aviz-card-reply-main{flex:1;min-width:0;}
#aviz-panel .aviz-card-reply-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;margin:0;padding:0;}
#aviz-panel .aviz-card-reply-author{font-size:13px;font-weight:500;color:#111827;margin:0;padding:0;line-height:1.3;}
#aviz-panel .aviz-card-reply-time{font-size:11px;color:#9ca3af;margin:0;padding:0;}
#aviz-panel .aviz-card-reply-text{font-size:13px;color:#374151;line-height:1.55;white-space:pre-wrap;word-break:break-word;margin:2px 0 0 0;padding:0;}

/* Action bar */
#aviz-panel .aviz-card-actions{display:flex;align-items:center;gap:16px;margin:12px 0 0 44px;padding:0;}
#aviz-panel .aviz-card-action{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#9ca3af;
  background:none;border:none;cursor:pointer;padding:0;margin:0;transition:color .2s;font-family:${FONT};}
#aviz-panel .aviz-card-action:hover{color:#111827;}
#aviz-panel .aviz-card-action.resolve:hover{color:#059669;}
#aviz-panel .aviz-card-action.reopen:hover{color:#d97706;}
#aviz-panel .aviz-card-action svg{flex-shrink:0;}
#aviz-panel .aviz-card-actions .aviz-menu-wrap{margin-left:auto;}

/* Reply form (inline in card) */
#aviz-panel .aviz-card-replyform{margin:12px 0 0 44px;padding:0;display:flex;flex-direction:column;gap:8px;}
#aviz-panel .aviz-card-replyform-row{display:flex;align-items:center;gap:8px;margin:0;padding:0;}
#aviz-panel .aviz-card-replyform-input{flex:1;display:flex;align-items:center;gap:4px;border-radius:12px;background:#F5F1EE;
  padding:0;margin:0;transition:box-shadow .2s;}
#aviz-panel .aviz-card-replyform-input:focus-within{box-shadow:0 0 0 2px ${ACCENT}33;}
#aviz-panel .aviz-card-replyform-input input{flex:1;padding:8px 12px;margin:0;border:none;background:transparent;
  font-size:13px;color:#111827;outline:none;font-family:${FONT};line-height:1.4;}
#aviz-panel .aviz-card-replyform-input input::placeholder{color:#9ca3af;}
#aviz-panel .aviz-card-replyform-send{width:32px;height:32px;border-radius:9999px;background:${ACCENT};color:#fff;
  display:inline-flex;align-items:center;justify-content:center;border:none;cursor:pointer;flex-shrink:0;
  transition:background .2s, opacity .2s;}
#aviz-panel .aviz-card-replyform-send:hover:not(:disabled){background:#015f68;}
#aviz-panel .aviz-card-replyform-send:disabled{opacity:.4;cursor:not-allowed;}

/* Edit textarea inside card */
#aviz-panel .aviz-card-edit{margin:6px 0 0 0;display:flex;flex-direction:column;gap:6px;}
#aviz-panel .aviz-card-edit textarea{width:100%;padding:8px 12px;border:none;border-radius:12px;background:#F5F1EE;
  font-size:13px;color:#111827;outline:none;resize:none;font-family:${FONT};line-height:1.5;transition:box-shadow .2s;}
#aviz-panel .aviz-card-edit textarea:focus{box-shadow:0 0 0 2px ${ACCENT}33;}
#aviz-panel .aviz-card-edit-bar{display:flex;align-items:center;gap:6px;margin:0;padding:0;}
#aviz-panel .aviz-card-edit-save{display:inline-flex;align-items:center;gap:3px;padding:4px 8px;border-radius:6px;
  background:${ACCENT};color:#fff;font-size:10px;font-weight:500;border:none;cursor:pointer;font-family:${FONT};
  transition:opacity .2s;}
#aviz-panel .aviz-card-edit-save:hover:not(:disabled){opacity:.9;}
#aviz-panel .aviz-card-edit-save:disabled{opacity:.4;cursor:not-allowed;}
#aviz-panel .aviz-card-edit-cancel{display:inline-flex;align-items:center;gap:3px;padding:4px 8px;border-radius:6px;
  background:transparent;color:#6b7280;font-size:10px;font-weight:500;border:1px solid #e5e7eb;cursor:pointer;font-family:${FONT};
  transition:background .2s;}
#aviz-panel .aviz-card-edit-cancel:hover{background:#f9fafb;}

/* Inline video clip */
#aviz-panel .aviz-card-video{display:block;width:100%;max-width:320px;border-radius:8px;background:#000;margin:8px 0 0 0;}

/* Reactions */
#aviz-panel .aviz-rxn-bar{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:8px 0 0 0;padding:0;}
#aviz-panel .aviz-rxn{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;margin:0;border-radius:9999px;
  background:#f3f4f6;border:1px solid transparent;font-size:12px;color:#374151;cursor:pointer;font-family:${FONT};
  transition:background .2s, border-color .2s;line-height:1.4;}
#aviz-panel .aviz-rxn:hover{background:#e5e7eb;}
#aviz-panel .aviz-rxn.mine{background:${ACCENT}1a;border-color:${ACCENT}66;color:${ACCENT};}
#aviz-panel .aviz-rxn-emoji{font-size:13px;line-height:1;}
#aviz-panel .aviz-rxn-add{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;
  border-radius:9999px;background:transparent;border:none;color:#9ca3af;cursor:pointer;padding:0;margin:0;
  transition:background .2s, color .2s;}
#aviz-panel .aviz-rxn-add:hover{background:#f3f4f6;color:#6b7280;}
#aviz-panel .aviz-rxn-picker{position:absolute;z-index:2147483645;background:#fff;border:1px solid #e5e7eb;
  border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,.12);padding:6px;display:flex;gap:2px;
  font-family:${FONT};}
#aviz-panel .aviz-rxn-picker button{width:28px;height:28px;display:flex;align-items:center;justify-content:center;
  background:transparent;border:none;cursor:pointer;font-size:16px;border-radius:6px;padding:0;margin:0;
  transition:background .2s;}
#aviz-panel .aviz-rxn-picker button:hover{background:#f3f4f6;}

/* Resolved section (collapsible at bottom) */
#aviz-panel .aviz-resolved-toggle{display:flex;align-items:center;gap:6px;width:100%;padding:8px 0;margin:0;
  background:none;border:none;cursor:pointer;font-size:10px;font-weight:600;text-transform:uppercase;
  letter-spacing:.05em;color:#9ca3af;font-family:${FONT};}
#aviz-panel .aviz-resolved-toggle svg{flex-shrink:0;}
#aviz-panel .aviz-resolved-list{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;}
#aviz-panel .aviz-resolved-card{background:#f9fafb;border:1px solid #f3f4f6;border-radius:10px;padding:12px;margin:0;opacity:.7;}
#aviz-panel .aviz-resolved-pin{display:flex;align-items:center;gap:6px;margin:0 0 6px 0;padding:0;}
#aviz-panel .aviz-resolved-pin-num{width:16px;height:16px;border-radius:9999px;background:#9ca3af;color:#fff;
  display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;line-height:1;}
#aviz-panel .aviz-resolved-row{display:flex;align-items:flex-start;gap:8px;}
#aviz-panel .aviz-resolved-avatar{width:20px;height:20px;border-radius:9999px;background:#e5e7eb;color:#6b7280;
  display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;line-height:1;}
#aviz-panel .aviz-resolved-author{font-size:11px;font-weight:500;color:#6b7280;margin:0;padding:0;}
#aviz-panel .aviz-resolved-text{font-size:11px;color:#9ca3af;margin:2px 0 0 0;padding:0;line-height:1.5;
  white-space:pre-wrap;word-break:break-word;}
#aviz-panel .aviz-resolved-foot{display:flex;align-items:center;gap:8px;margin:6px 0 0 0;padding:0;}
#aviz-panel .aviz-resolved-tag{display:inline-flex;align-items:center;gap:3px;font-size:10px;color:#9ca3af;}
#aviz-panel .aviz-resolved-tag svg{color:#10b981;}
#aviz-panel .aviz-resolved-reopen{display:inline-flex;align-items:center;gap:3px;font-size:10px;color:#9ca3af;
  background:none;border:none;cursor:pointer;padding:0;margin:0;font-family:${FONT};transition:color .2s;}
#aviz-panel .aviz-resolved-reopen:hover{color:#d97706;}

/* Empty state */
#aviz-panel .aviz-empty{text-align:center;padding:48px 16px;margin:0;color:#9ca3af;font-size:13px;}
#aviz-panel .aviz-empty .aviz-empty-icon{display:flex;justify-content:center;margin:0 0 12px 0;color:#d1d5db;}
#aviz-panel .aviz-empty p{margin:0;padding:0;font-size:13px;color:#9ca3af;}

/* Footer (general comment) */
#aviz-panel .aviz-pf{padding:12px 16px 20px;margin:0;flex-shrink:0;}
#aviz-panel .aviz-footer-trigger{width:100%;text-align:left;padding:12px 16px;margin:0;border-radius:16px;font-size:13px;
  color:#9ca3af;border:none;background:#fff;cursor:pointer;
  box-shadow:0 1px 2px rgba(20,20,40,0.04),0 4px 16px rgba(20,20,40,0.03);
  transition:color .2s;font-family:${FONT};}
#aviz-panel .aviz-footer-trigger:hover{color:#6b7280;}
#aviz-panel .aviz-footer-form{background:#fff;border-radius:16px;padding:14px 16px;margin:0;
  box-shadow:0 1px 2px rgba(20,20,40,0.04),0 4px 16px rgba(20,20,40,0.03);
  display:flex;flex-direction:column;gap:8px;}
#aviz-panel .aviz-footer-form .aviz-footer-name{width:100%;padding:8px 12px;margin:0;border:none;border-radius:12px;
  background:#F5F1EE;font-size:13px;color:#111827;outline:none;font-family:${FONT};transition:box-shadow .2s;}
#aviz-panel .aviz-footer-form .aviz-footer-name:focus{box-shadow:0 0 0 2px ${ACCENT}33;}
#aviz-panel .aviz-footer-form .aviz-footer-text{width:100%;padding:4px 0;margin:0;border:none;background:transparent;
  font-size:13px;color:#111827;outline:none;resize:none;font-family:${FONT};line-height:1.6;}
#aviz-panel .aviz-footer-form .aviz-footer-text::placeholder{color:#9ca3af;}
#aviz-panel .aviz-footer-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:0;padding:0;}
#aviz-panel .aviz-footer-cancel{font-size:12px;padding:4px 8px;margin:0;color:#9ca3af;background:none;border:none;
  cursor:pointer;font-family:${FONT};font-weight:500;transition:color .2s;}
#aviz-panel .aviz-footer-cancel:hover{color:#111827;}
#aviz-panel .aviz-footer-post{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;margin:0;border-radius:9999px;
  background:${ACCENT};color:#fff;font-size:12px;font-weight:600;border:none;cursor:pointer;
  font-family:${FONT};transition:background .2s, opacity .2s;}
#aviz-panel .aviz-footer-post:hover:not(:disabled){background:#015f68;}
#aviz-panel .aviz-footer-post:disabled{opacity:.4;cursor:not-allowed;}

/* ══════════════════════════════════════════════════════════
   FORM INPUTS  (shared by panel footer + annotation forms)
   ══════════════════════════════════════════════════════════ */
.aviz-inp{width:100%;padding:8px 12px;margin:0;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;
  color:#111;outline:none;transition:border-color .15s,box-shadow .15s;background:#fff;font-family:${FONT};}
.aviz-inp:focus{border-color:${ACCENT};box-shadow:0 0 0 3px ${ACCENT}20;}
.aviz-inp::placeholder{color:#9ca3af;}
.aviz-ta{width:100%;padding:8px 12px;margin:0;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;
  color:#111;outline:none;resize:none;min-height:56px;background:#fff;transition:border-color .15s,box-shadow .15s;font-family:${FONT};}
.aviz-ta:focus{border-color:${ACCENT};box-shadow:0 0 0 3px ${ACCENT}20;}
.aviz-ta::placeholder{color:#9ca3af;}

.aviz-cancel-btn{font-size:13px;padding:6px 12px;margin:0;color:#9ca3af;background:none;border:none;cursor:pointer;
  font-family:${FONT};font-weight:500;transition:color .3s;border-radius:6px;}
.aviz-cancel-btn:hover{color:#6b7280;background:#f3f4f6;}

.aviz-post-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;margin:0;border-radius:6px;
  background:${ACCENT};color:#fff;font-size:12px;font-weight:600;border:none;cursor:pointer;
  font-family:${FONT};transition:background .3s;}
.aviz-post-btn:hover:not(:disabled){background:#015f68;}
.aviz-post-btn:disabled{opacity:.4;cursor:not-allowed;}
.aviz-post-btn.sm{padding:6px 8px;}

/* Legacy shared buttons (annotation form) */
.aviz-btn{padding:7px 16px;margin:0;border-radius:9999px;font-size:12px;font-weight:600;border:none;cursor:pointer;
  transition:opacity .3s,background .3s;font-family:${FONT};}
.aviz-btn:disabled{opacity:.4;cursor:not-allowed;}
.aviz-btn-p{background:${ACCENT};color:#fff;}.aviz-btn-p:hover:not(:disabled){opacity:.9;}
.aviz-btn-g{background:transparent;color:#9ca3af;}.aviz-btn-g:hover{color:#6b7280;}
.aviz-pf-row{display:flex;gap:6px;margin-top:8px;align-items:center;}

/* ── Comment menu (edit / delete) ──────────────────────── */
.aviz-menu-wrap{position:relative;display:inline-flex;margin-left:auto;}
.aviz-menu-btn{background:none;border:none;cursor:pointer;font-size:16px;color:#999;padding:0 4px;
  line-height:1;border-radius:4px;transition:all .3s;}
.aviz-menu-btn:hover{background:#f0f0f0;color:#555;}
.aviz-menu{display:none;position:absolute;right:0;top:100%;margin-top:4px;z-index:10;
  background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);
  min-width:120px;padding:4px;overflow:hidden;}
.aviz-menu.open{display:block;}
.aviz-menu-item{display:block;width:100%;padding:7px 12px;border:none;background:none;cursor:pointer;
  text-align:left;font-size:12px;color:#333;border-radius:5px;transition:background .3s;}
.aviz-menu-item:hover{background:#f5f5f5;}
.aviz-menu-item.danger{color:#ef4444;}
.aviz-menu-item.danger:hover{background:#fef2f2;}

/* ── Highlight + annotations ───────────────────────────── */
.aviz-hl{outline:2px solid ${ACCENT}80;outline-offset:2px;cursor:crosshair;}
.aviz-anno-pin{position:absolute;z-index:2147483639;cursor:pointer;transition:transform .3s;}
.aviz-anno-pin:hover{transform:scale(1.15);}
.aviz-anno-box{position:absolute;z-index:2147483638;border:2px dashed ${ACCENT};cursor:pointer;transition:opacity .3s;}
.aviz-anno-box:hover{opacity:.8;}
.aviz-anno-text{position:absolute;z-index:2147483638;cursor:pointer;transition:opacity .3s;}
.aviz-anno-text:hover{opacity:.8;}
.aviz-anno-resolved{opacity:.35;pointer-events:none;}

/* ── Contenteditable mention editor ────────────────────── */
.aviz-editor{position:relative;min-height:36px;padding:8px 10px;border-radius:6px;border:1px solid #e5e7eb;background:#fff;
  outline:none;font:inherit;color:#1f2937;line-height:1.45;white-space:pre-wrap;word-break:break-word;cursor:text;}
.aviz-editor:focus{border-color:${ACCENT};box-shadow:0 0 0 3px ${ACCENT}22;}
.aviz-editor p{margin:0;}
.aviz-editor:empty::before{content:attr(data-placeholder);color:#9CA3AF;pointer-events:none;}
.aviz-footer-text.aviz-editor{min-height:48px;}
.aviz-card-edit-ta.aviz-editor{min-height:40px;}
.aviz-reply-text.aviz-editor{border:none;padding:6px 8px;background:transparent;min-height:30px;}

.aviz-mention-pill{display:inline-block;padding:1px 6px;border-radius:4px;background:${ACCENT}22;color:${ACCENT};
  font-weight:600;font-size:.92em;line-height:1.2;white-space:nowrap;cursor:default;}
.aviz-card-content .aviz-mention-pill,
.aviz-card-reply-text .aviz-mention-pill,
.aviz-resolved-text .aviz-mention-pill{user-select:text;}

/* Mention autocomplete dropdown — appended to body so it floats free of
   any clipping ancestors (host site scroll containers, etc.). */
.aviz-mention-dropdown{position:absolute;z-index:2147483646;min-width:220px;max-width:300px;max-height:240px;
  overflow-y:auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;
  box-shadow:0 10px 30px rgba(0,0,0,.12);font-family:${FONT};padding:4px;}
.aviz-mention-item{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:none;background:none;
  cursor:pointer;border-radius:5px;font-size:12px;color:#1f2937;text-align:left;}
.aviz-mention-item.active,.aviz-mention-item:hover{background:${ACCENT}14;}
.aviz-mention-avatar{flex-shrink:0;width:20px;height:20px;border-radius:50%;background:#e5e7eb;color:#4b5563;
  display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;}
.aviz-mention-name{flex:1;min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.aviz-mention-email{margin-left:6px;color:#9ca3af;font-weight:400;}
.aviz-mention-kind{flex-shrink:0;font-size:9px;letter-spacing:.04em;text-transform:uppercase;padding:1px 5px;border-radius:3px;}
.aviz-mention-kind-team{background:${ACCENT}18;color:${ACCENT};}
.aviz-mention-kind-guest{background:#fef3c7;color:#b45309;}
.aviz-mention-empty{padding:8px 10px;font-size:12px;color:#9ca3af;}
\`;
document.head.appendChild(sty);
`;
}