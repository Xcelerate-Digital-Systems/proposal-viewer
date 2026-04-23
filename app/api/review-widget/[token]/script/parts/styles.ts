import { POPOVER_STYLE } from '@/lib/feedback/popover-style';

const ACCENT = '#017C87';
const PIN_COLOR = '#22c55e'; // green-500 — consistent with in-app PinOverlay
const HOVER_COLOR = '#f97316'; // orange-500 — element hover outline during pin placement
const FONT = `'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`;

export function stylesJS(_apiBase: string): string {
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

/* ── Crosshair cursor (always on outside widget UI) ────── */
html.aviz-active,html.aviz-active *:not(#aviz-root):not(#aviz-root *):not(#aviz-onboard):not(#aviz-onboard *){cursor:crosshair !important;}

/* ── Element hover highlight ───────────────────────────── */
.aviz-el-hl{outline:2px solid ${HOVER_COLOR};outline-offset:2px;transition:outline-color .1s;box-shadow:0 0 0 1px ${HOVER_COLOR}40;}

/* ── Pin marker ────────────────────────────────────────── */
.aviz-pin{position:absolute;z-index:2147483639;width:28px;height:28px;border-radius:50%;
  background:${PIN_COLOR};color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;
  justify-content:center;cursor:pointer;transform:translate(-50%,-50%);
  box-shadow:0 2px 8px rgba(0,0,0,.25);border:2px solid #fff;
  transition:transform .1s,box-shadow .1s;}
.aviz-pin:hover{transform:translate(-50%,-50%) scale(1.15);box-shadow:0 4px 12px rgba(0,0,0,.3);}
.aviz-pin.pending{animation:aviz-pinPulse .8s ease-in-out infinite alternate;}
@keyframes aviz-pinPulse{from{box-shadow:0 2px 8px rgba(0,0,0,.25);}to{box-shadow:0 2px 16px ${PIN_COLOR}60;}}

/* ── Box drawing ───────────────────────────────────────── */
.aviz-draw-box{position:absolute;z-index:2147483639;border:2px dashed ${ACCENT};background:${ACCENT}10;pointer-events:none;}
.aviz-box{position:absolute;z-index:2147483639;border:2px solid ${ACCENT};background:${ACCENT}08;cursor:pointer;transition:opacity .15s;}
.aviz-box:hover{background:${ACCENT}15;}
.aviz-box.pending{animation:aviz-boxPulse .8s ease-in-out infinite alternate;}
@keyframes aviz-boxPulse{from{border-color:${ACCENT};}to{border-color:${ACCENT}80;}}

/* ── Text annotation input ─────────────────────────────── */
.aviz-text-input{position:absolute;z-index:2147483639;min-width:120px;padding:6px 10px;
  border:2px solid ${ACCENT};border-radius:6px;background:#fff;font-size:13px;color:#111;
  outline:none;box-shadow:0 2px 8px rgba(0,0,0,.15);font-family:${FONT};}
.aviz-text-ann{position:absolute;z-index:2147483639;padding:4px 8px;background:${ACCENT};
  color:#fff;font-size:12px;font-weight:500;border-radius:4px;cursor:pointer;
  white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.2);transition:opacity .15s;}
.aviz-text-ann:hover{opacity:.85;}

/* ── Text mode: inline comment form ────────────────────── */
.aviz-text-input-wrap{position:absolute;z-index:2147483643;width:300px;background:#fff;border-radius:12px;
  box-shadow:0 8px 40px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.06);padding:14px;
  animation:aviz-fadeIn .15s ease-out;}

/* ── Toolbar ───────────────────────────────────────────── */
#aviz-toolbar{position:fixed;right:20px;top:50%;transform:translateY(-50%);z-index:2147483640;
  display:flex;flex-direction:column;background:#fff;border-radius:16px;
  box-shadow:0 4px 24px rgba(0,0,0,.12),0 1px 4px rgba(0,0,0,.06);overflow:visible;
  border:1px solid rgba(0,0,0,.06);transition:right .25s cubic-bezier(.4,0,.2,1);}
.aviz-tool{position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;
  background:transparent;border:none;cursor:pointer;color:#666;transition:all .15s;margin:0;padding:0;}
.aviz-tool:not(:last-child){border-bottom:1px solid #f0f0f0;}
.aviz-tool:first-child{border-radius:16px 16px 0 0;}.aviz-tool:last-child{border-radius:0 0 16px 16px;}
.aviz-tool:hover{background:#f5f5f5;color:#333;}
.aviz-tool.active{background:${ACCENT}12;color:${ACCENT};}
.aviz-tool .aviz-badge{position:absolute;top:4px;right:4px;min-width:16px;height:16px;border-radius:8px;
  background:#ef4444;color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;
  justify-content:center;padding:0 3px;border:2px solid #fff;line-height:1;}
.aviz-tool .aviz-badge:empty{display:none;}
.aviz-tooltip{position:absolute;right:calc(100% + 10px);top:50%;transform:translateY(-50%);
  background:#111;color:#fff;font-size:11px;font-weight:500;padding:6px 10px;border-radius:8px;
  white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s;z-index:2147483641;}
.aviz-tool:hover .aviz-tooltip{opacity:1;}
.aviz-sep{width:100%;height:1px;background:#e5e7eb;flex-shrink:0;margin:0;padding:0;}
#aviz-toolbar.panel-open{right:360px;}
@media(max-width:480px){
  #aviz-toolbar{right:10px;}
  .aviz-tool{width:42px;height:42px;}
  #aviz-toolbar.panel-open{right:calc(100vw - 6px);}
}

/* ── Mode bar (top bar when pin/box/text active) ───────── */
#aviz-bar{position:fixed;top:0;left:0;right:0;z-index:2147483642;background:${ACCENT};
  color:#fff;display:none;align-items:center;justify-content:center;gap:12px;padding:10px 16px;
  font-size:13px;font-weight:500;box-shadow:0 2px 12px rgba(0,0,0,.15);}
#aviz-bar.show{display:flex;}
#aviz-bar button{background:rgba(255,255,255,.2);color:#fff;border:none;border-radius:6px;
  padding:5px 14px;font-size:12px;cursor:pointer;font-weight:500;font-family:${FONT};transition:background .15s;margin:0;}
#aviz-bar button:hover{background:rgba(255,255,255,.3);}

/* ── Annotation form (floating card) ───────────────────── */
.aviz-pin-form{position:absolute;z-index:2147483643;width:${POPOVER_STYLE.widthPx}px;max-width:calc(100vw - 40px);background:${POPOVER_STYLE.background};border-radius:16px;
  box-shadow:${POPOVER_STYLE.boxShadow};padding:16px;border:1px solid ${POPOVER_STYLE.borderColor};
  animation:aviz-fadeIn .15s ease-out;}
@keyframes aviz-fadeIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
.aviz-pin-form h4{font-size:11px;font-weight:500;color:#9ca3af;margin:0 0 8px 0;padding:0;}
.aviz-pf-quote{margin:0 0 10px 0;padding:6px 10px;border-left:3px solid #fde047;background:#fefce8;border-radius:0 6px 6px 0;font-size:11px;color:#92400e;font-style:italic;}

/* ── Text highlight marks ──────────────────────────────── */
mark.aviz-hl{background:rgba(253,224,71,.55);padding:1px 2px;border-radius:2px;cursor:pointer;transition:background .15s;color:inherit;}
mark.aviz-hl:hover{background:rgba(253,224,71,.8);}
mark.aviz-hl.resolved{background:rgba(253,224,71,.28);}
.aviz-hl-badge{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 4px;margin-left:3px;border-radius:9999px;background:${ACCENT};color:#fff;font-size:10px;font-weight:700;line-height:1;vertical-align:middle;cursor:pointer;user-select:none;font-style:normal;font-family:${FONT};}

/* ── Priority selector (shared across pin, text, highlight forms) ── */
.aviz-priority{position:relative;display:inline-flex;}
.aviz-priority-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;background:transparent;border:none;color:#9ca3af;cursor:pointer;padding:0;margin:0;transition:background .12s,color .12s;}
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
.aviz-vid-start{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 18px;border:none;border-radius:12px;background:#ef4444;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:${FONT};transition:background .15s;}
.aviz-vid-start:hover{background:#dc2626;}
.aviz-vid-status{display:flex;align-items:center;gap:8px;padding:12px 14px;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:13px;font-weight:500;}
.aviz-vid-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;animation:aviz-pulse 1s ease-in-out infinite;}
@keyframes aviz-pulse{0%,100%{opacity:1}50%{opacity:.4}}
.aviz-vid-timer{margin-left:auto;font-family:ui-monospace,Menlo,Monaco,monospace;font-size:13px;color:#991b1b;}
.aviz-vid-stop{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 18px;border:none;border-radius:12px;background:#111827;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:${FONT};transition:background .15s;}
.aviz-vid-stop:hover{background:#1f2937;}
.aviz-vid-preview{width:100%;max-height:380px;border-radius:12px;background:#000;display:block;}
.aviz-vid-len{margin:0;padding:0;text-align:center;font-size:11px;color:#9ca3af;}
.aviz-vid-actions{display:flex;gap:8px;}
.aviz-vid-redo{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;color:#374151;font-size:13px;font-weight:600;cursor:pointer;font-family:${FONT};}
.aviz-vid-redo:hover{background:#f9fafb;}
.aviz-vid-accept{flex:1.4;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 14px;border:none;border-radius:12px;background:${ACCENT};color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:${FONT};transition:background .15s;}
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
#aviz-onboard .aviz-onboard-card{width:100%;max-width:380px;background:#fff;border-radius:16px;
  box-shadow:0 20px 60px rgba(0,0,0,.25);padding:24px;font-family:${FONT};}
#aviz-onboard h3{font-size:18px;font-weight:600;color:#111;margin:0 0 6px 0;padding:0;font-family:${FONT};}
#aviz-onboard p.aviz-onboard-sub{font-size:13px;color:#6b7280;margin:0 0 18px 0;padding:0;line-height:1.5;}
#aviz-onboard label{display:block;font-size:11px;font-weight:500;color:#6b7280;margin:0 0 4px 0;padding:0;text-transform:uppercase;letter-spacing:.3px;}
#aviz-onboard .aviz-onboard-field{margin:0 0 12px 0;padding:0;}
#aviz-onboard .aviz-onboard-field:last-of-type{margin-bottom:18px;}
#aviz-onboard input{width:100%;padding:10px 12px;margin:0;border:1px solid #e5e7eb;border-radius:8px;
  font-size:14px;color:#111;outline:none;background:#fff;font-family:${FONT};
  transition:border-color .15s,box-shadow .15s;}
#aviz-onboard input:focus{border-color:${ACCENT};box-shadow:0 0 0 3px ${ACCENT}20;}
#aviz-onboard .aviz-onboard-submit{width:100%;padding:11px 18px;margin:0;border-radius:10px;
  background:${ACCENT};color:#fff;font-size:14px;font-weight:600;border:none;cursor:pointer;
  font-family:${FONT};transition:background .15s;}
#aviz-onboard .aviz-onboard-submit:hover:not(:disabled){background:#015f68;}
#aviz-onboard .aviz-onboard-submit:disabled{opacity:.5;cursor:not-allowed;}
#aviz-onboard .aviz-onboard-optional{font-size:10px;color:#9ca3af;font-weight:400;text-transform:none;letter-spacing:0;margin-left:4px;}

/* ══════════════════════════════════════════════════════════
   COMMENTS PANEL  –  Feedbucket style
   ══════════════════════════════════════════════════════════ */
#aviz-panel{position:fixed;top:0;right:0;bottom:0;z-index:2147483641;width:340px;
  background:#fff;border-left:1px solid #e5e7eb;
  box-shadow:-4px 0 24px rgba(0,0,0,.06);display:flex;flex-direction:column;
  transform:translateX(100%);transition:transform .25s cubic-bezier(.4,0,.2,1);pointer-events:none;}
#aviz-panel.open{transform:translateX(0);pointer-events:all;}
@media(max-width:480px){#aviz-panel{width:calc(100vw - 16px);}}

/* ── Panel header ──────────────────────────────────────── */
#aviz-panel .aviz-ph{padding:14px 16px;margin:0;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
#aviz-panel .aviz-ph-left{display:flex;align-items:center;gap:8px;margin:0;padding:0;}
#aviz-panel .aviz-ph-title{font-size:16px;font-weight:600;color:#111;margin:0;padding:0;}
#aviz-panel .aviz-ph-dots{background:none;border:none;cursor:pointer;color:#9ca3af;font-size:18px;padding:2px 4px;margin:0;
  border-radius:4px;transition:background .15s;line-height:1;}
#aviz-panel .aviz-ph-dots:hover{background:#f3f4f6;}
#aviz-panel .aviz-ph-close{width:28px;height:28px;border-radius:6px;border:none;background:transparent;color:#9ca3af;
  cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;margin:0;padding:0;}
#aviz-panel .aviz-ph-close:hover{background:#f3f4f6;color:#6b7280;}

/* ── Tabs: Open / Resolved + Filter ────────────────────── */
#aviz-panel .aviz-tabs{display:flex;align-items:center;padding:0 16px;margin:0;border-bottom:1px solid #e5e7eb;flex-shrink:0;}
#aviz-panel .aviz-tabs-left{display:flex;flex:1;gap:0;margin:0;padding:0;}
#aviz-panel .aviz-tab{padding:10px 14px;margin:0;font-size:14px;font-weight:500;color:#9ca3af;background:none;border:none;
  border-bottom:2px solid transparent;cursor:pointer;transition:all .15s;font-family:${FONT};
  display:flex;align-items:center;gap:6px;}
#aviz-panel .aviz-tab:hover{color:#6b7280;}
#aviz-panel .aviz-tab.active{color:#111;border-bottom-color:${ACCENT};}
#aviz-panel .aviz-tab-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;
  border-radius:10px;font-size:11px;font-weight:600;padding:0 6px;margin:0;}
#aviz-panel .aviz-tab.active .aviz-tab-count{background:${ACCENT};color:#fff;}
#aviz-panel .aviz-tab:not(.active) .aviz-tab-count{background:#f3f4f6;color:#9ca3af;}
#aviz-panel .aviz-filter-btn{display:flex;align-items:center;gap:4px;padding:5px 10px;margin:0 0 0 auto;border-radius:6px;
  border:1px solid #e5e7eb;background:#fff;color:#6b7280;font-size:12px;font-weight:500;
  cursor:pointer;transition:all .15s;font-family:${FONT};flex-shrink:0;}
#aviz-panel .aviz-filter-btn:hover{border-color:#d1d5db;color:#374151;background:#f9fafb;}
#aviz-panel .aviz-filter-btn svg{flex-shrink:0;}

/* ── Page label ────────────────────────────────────────── */
#aviz-panel .aviz-page-label{padding:10px 16px;margin:0;font-size:11px;font-weight:500;color:#9ca3af;
  border-bottom:1px solid #f3f4f6;flex-shrink:0;text-transform:uppercase;letter-spacing:.3px;}

/* ── Body ──────────────────────────────────────────────── */
#aviz-panel .aviz-pb{flex:1;overflow-y:auto;padding:0;margin:0;}
#aviz-panel .aviz-pb::-webkit-scrollbar{width:4px;}
#aviz-panel .aviz-pb::-webkit-scrollbar-track{background:transparent;}
#aviz-panel .aviz-pb::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:2px;}

/* ── Other Pages section ───────────────────────────────── */
#aviz-panel .aviz-other-pages{border-top:1px solid #e5e7eb;flex-shrink:0;}
#aviz-panel .aviz-other-pages-header{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;margin:0;
  cursor:pointer;transition:background .15s;user-select:none;}
#aviz-panel .aviz-other-pages-header:hover{background:#f9fafb;}
#aviz-panel .aviz-other-pages-label{font-size:12px;font-weight:500;color:#6b7280;margin:0;padding:0;}
#aviz-panel .aviz-other-pages-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;
  height:20px;border-radius:10px;font-size:11px;font-weight:600;padding:0 6px;margin:0 0 0 6px;
  background:#f3f4f6;color:#9ca3af;}
#aviz-panel .aviz-other-pages-chevron{color:#9ca3af;transition:transform .2s;flex-shrink:0;}
#aviz-panel .aviz-other-pages-header.open .aviz-other-pages-chevron{transform:rotate(180deg);}

/* ── Footer ────────────────────────────────────────────── */
#aviz-panel .aviz-pf{padding:12px 16px;margin:0;border-top:1px solid #e5e7eb;flex-shrink:0;}
#aviz-panel .aviz-footer-trigger{width:100%;text-align:left;padding:10px 12px;margin:0;border-radius:8px;font-size:13px;
  color:#9ca3af;border:1px solid #e5e7eb;background:#fff;cursor:pointer;transition:border-color .15s;
  font-family:${FONT};}
#aviz-panel .aviz-footer-trigger:hover{border-color:#d1d5db;}
#aviz-panel .aviz-footer-bar{display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding:0;}
#aviz-panel .aviz-footer-left{display:flex;align-items:center;gap:4px;margin:0;padding:0;}
#aviz-panel .aviz-footer-icon{width:28px;height:28px;display:flex;align-items:center;justify-content:center;
  background:none;border:none;cursor:pointer;color:#9ca3af;border-radius:6px;transition:all .15s;margin:0;padding:0;}
#aviz-panel .aviz-footer-icon:hover{color:#6b7280;background:#f3f4f6;}
#aviz-panel .aviz-footer-right{display:flex;align-items:center;gap:6px;margin:0;padding:0;}
#aviz-panel .aviz-footer-vis{display:flex;align-items:center;gap:4px;padding:4px 8px;margin:0;border-radius:6px;
  font-size:11px;font-weight:500;color:#6b7280;background:none;border:none;cursor:pointer;
  transition:all .15s;font-family:${FONT};}
#aviz-panel .aviz-footer-vis:hover{background:#f3f4f6;color:#374151;}
#aviz-panel .aviz-footer-vis svg{flex-shrink:0;}

/* ══════════════════════════════════════════════════════════
   THREAD CARD  –  Flat Feedbucket style with expand/collapse
   ══════════════════════════════════════════════════════════ */
#aviz-panel .aviz-card{background:#fff;border-bottom:1px solid #f3f4f6;padding:12px 16px;margin:0;cursor:pointer;
  transition:background .15s;}
#aviz-panel .aviz-card:hover{background:#fafafa;}
#aviz-panel .aviz-card.expanded{background:#fff;cursor:default;padding:14px 16px 16px;}
#aviz-panel .aviz-card.expanded:hover{background:#fff;}
#aviz-panel .aviz-card.highlight{background:#fefce8;}

/* Card header: author */
#aviz-panel .aviz-card-head{display:flex;align-items:center;gap:8px;margin:0 0 2px 0;padding:0;}
#aviz-panel .aviz-card-author{font-size:14px;font-weight:600;color:#111;margin:0;padding:0;}
#aviz-panel .aviz-card-team{font-size:9px;font-weight:600;text-transform:uppercase;padding:2px 6px;margin:0;border-radius:4px;
  background:${ACCENT}12;color:${ACCENT};letter-spacing:.3px;}
#aviz-panel .aviz-card-team.sm{font-size:8px;padding:1px 5px;}

/* Card content */
#aviz-panel .aviz-card-content{font-size:14px;color:#374151;line-height:1.5;white-space:pre-wrap;word-break:break-word;margin:0;padding:0;}

/* ── Collapsed card: compact meta row ──────────────────── */
#aviz-panel .aviz-card-compact-meta{display:flex;align-items:center;gap:12px;margin:6px 0 0 0;padding:0;}
#aviz-panel .aviz-card-compact-item{display:flex;align-items:center;gap:3px;font-size:11px;color:#9ca3af;margin:0;padding:0;}
#aviz-panel .aviz-card-compact-item svg{flex-shrink:0;opacity:.7;}

/* ── Expanded card sections ────────────────────────────── */
#aviz-panel .aviz-card-expanded{display:none;}
#aviz-panel .aviz-card.expanded .aviz-card-expanded{display:block;}
#aviz-panel .aviz-card.expanded .aviz-card-compact-meta{display:none;}

/* Replies inside expanded card */
#aviz-panel .aviz-card-replies{border-top:1px solid #f3f4f6;padding:10px 0 0 0;margin:10px 0 8px 0;}
#aviz-panel .aviz-card-reply{margin:0 0 8px 0;padding:0;}
#aviz-panel .aviz-card-reply:last-child{margin-bottom:0;}
#aviz-panel .aviz-card-reply-head{display:flex;align-items:center;gap:6px;margin:0 0 1px 0;padding:0;}
#aviz-panel .aviz-card-reply-author{font-size:13px;font-weight:600;color:#111;margin:0;padding:0;}
#aviz-panel .aviz-card-reply-time{font-size:10px;color:#9ca3af;margin:0;padding:0;}
#aviz-panel .aviz-card-reply-text{font-size:13px;color:#4b5563;line-height:1.5;white-space:pre-wrap;word-break:break-word;margin:0;padding:0;}

/* Screenshot thumbnail + meta in expanded view */
#aviz-panel .aviz-card-meta{display:flex;align-items:flex-start;gap:10px;margin:10px 0;padding:0;}
#aviz-panel .aviz-card-thumb{width:56px;height:42px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;
  cursor:pointer;flex-shrink:0;transition:opacity .15s;margin:0;padding:0;}
#aviz-panel .aviz-card-thumb:hover{opacity:.8;}
#aviz-panel .aviz-card-meta-info{display:flex;flex-direction:column;gap:2px;min-width:0;margin:0;padding:0;}
#aviz-panel .aviz-card-meta-row{font-size:11px;color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0;padding:0;}

/* Time (no screenshot) in expanded view */
#aviz-panel .aviz-card-time{font-size:11px;color:#9ca3af;margin:8px 0;padding:0;}

/* ── Expanded card: inline comment input ──────────────── */
#aviz-panel .aviz-card-comment-input{margin:10px 0 0 0;padding:10px 0 0 0;border-top:1px solid #f3f4f6;}
#aviz-panel .aviz-card-comment-placeholder{width:100%;text-align:left;padding:8px 12px;margin:0;border-radius:8px;font-size:14px;
  color:#9ca3af;border:1px solid #e5e7eb;background:#fff;cursor:text;transition:border-color .15s;
  font-family:${FONT};}
#aviz-panel .aviz-card-comment-placeholder:hover{border-color:#d1d5db;}
#aviz-panel .aviz-card-comment-form{margin:0;padding:0;}

/* ── Expanded card: action bar ─────────────────────────── */
#aviz-panel .aviz-card-bar{display:flex;align-items:center;justify-content:space-between;margin:10px 0 0 0;
  padding:10px 0 0 0;border-top:1px solid #f3f4f6;}
#aviz-panel .aviz-card-bar-left{display:flex;align-items:center;gap:4px;margin:0;padding:0;}
#aviz-panel .aviz-card-bar-right{display:flex;align-items:center;gap:6px;margin:0;padding:0;}

#aviz-panel .aviz-card-action{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#9ca3af;
  background:none;border:none;cursor:pointer;padding:4px 6px;margin:0;border-radius:4px;transition:all .15s;
  font-family:${FONT};}
#aviz-panel .aviz-card-action:hover{color:#6b7280;background:#f3f4f6;}

#aviz-panel .aviz-card-resolve{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:500;
  color:#6b7280;background:none;border:none;cursor:pointer;padding:5px 10px;margin:0;border-radius:6px;
  transition:all .15s;font-family:${FONT};}
#aviz-panel .aviz-card-resolve:hover{color:#059669;}
#aviz-panel .aviz-card-resolve svg{flex-shrink:0;}

#aviz-panel .aviz-card-comment-btn{display:inline-flex;align-items:center;gap:4px;padding:6px 14px;margin:0;border-radius:6px;
  background:${ACCENT};color:#fff;font-size:12px;font-weight:600;border:none;cursor:pointer;
  font-family:${FONT};transition:background .15s;}
#aviz-panel .aviz-card-comment-btn:hover:not(:disabled){background:#015f68;}
#aviz-panel .aviz-card-comment-btn:disabled{opacity:.4;cursor:not-allowed;}

#aviz-panel .aviz-card-reopen{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:500;
  color:#9ca3af;background:none;border:1px solid #e5e7eb;cursor:pointer;padding:5px 10px;margin:0;border-radius:6px;
  transition:all .15s;font-family:${FONT};}
#aviz-panel .aviz-card-reopen:hover{color:#d97706;border-color:#d97706;background:#fffbeb;}

/* ── Reply form (inline in expanded card) ─────────────── */
#aviz-panel .aviz-reply-form{padding:8px 0;margin:0 0 4px 0;}
#aviz-panel .aviz-reply-input-row{display:flex;gap:6px;align-items:center;margin:0;padding:0;}

/* ── Empty / loading ──────────────────────────────────── */
#aviz-panel .aviz-empty{text-align:center;padding:40px 16px;margin:0;color:#9ca3af;font-size:13px;}
#aviz-panel .aviz-empty p{margin:0;padding:0;}
#aviz-panel .aviz-empty-sub{font-size:12px;margin:4px 0 0 0;padding:0;color:#d1d5db;}

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
  font-family:${FONT};font-weight:500;transition:color .15s;border-radius:6px;}
.aviz-cancel-btn:hover{color:#6b7280;background:#f3f4f6;}

.aviz-post-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;margin:0;border-radius:6px;
  background:${ACCENT};color:#fff;font-size:12px;font-weight:600;border:none;cursor:pointer;
  font-family:${FONT};transition:background .15s;}
.aviz-post-btn:hover:not(:disabled){background:#015f68;}
.aviz-post-btn:disabled{opacity:.4;cursor:not-allowed;}
.aviz-post-btn.sm{padding:6px 8px;}

/* Legacy shared buttons (annotation form) */
.aviz-btn{padding:7px 16px;margin:0;border-radius:9999px;font-size:12px;font-weight:600;border:none;cursor:pointer;
  transition:opacity .15s,background .15s;font-family:${FONT};}
.aviz-btn:disabled{opacity:.4;cursor:not-allowed;}
.aviz-btn-p{background:${ACCENT};color:#fff;}.aviz-btn-p:hover:not(:disabled){opacity:.9;}
.aviz-btn-g{background:transparent;color:#9ca3af;}.aviz-btn-g:hover{color:#6b7280;}
.aviz-pf-row{display:flex;gap:6px;margin-top:8px;align-items:center;}

/* ── Comment menu (edit / delete) ──────────────────────── */
.aviz-menu-wrap{position:relative;display:inline-flex;margin-left:auto;}
.aviz-menu-btn{background:none;border:none;cursor:pointer;font-size:16px;color:#999;padding:0 4px;
  line-height:1;border-radius:4px;transition:all .12s;}
.aviz-menu-btn:hover{background:#f0f0f0;color:#555;}
.aviz-menu{display:none;position:absolute;right:0;top:100%;margin-top:4px;z-index:10;
  background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);
  min-width:120px;padding:4px;overflow:hidden;}
.aviz-menu.open{display:block;}
.aviz-menu-item{display:block;width:100%;padding:7px 12px;border:none;background:none;cursor:pointer;
  text-align:left;font-size:12px;color:#333;border-radius:5px;transition:background .1s;}
.aviz-menu-item:hover{background:#f5f5f5;}
.aviz-menu-item.danger{color:#ef4444;}
.aviz-menu-item.danger:hover{background:#fef2f2;}

/* ── Highlight + annotations ───────────────────────────── */
.aviz-hl{outline:2px solid ${ACCENT}80;outline-offset:2px;cursor:crosshair;}
.aviz-anno-pin{position:absolute;z-index:2147483639;cursor:pointer;transition:transform .1s;}
.aviz-anno-pin:hover{transform:scale(1.15);}
.aviz-anno-box{position:absolute;z-index:2147483638;border:2px dashed ${ACCENT};cursor:pointer;transition:opacity .15s;}
.aviz-anno-box:hover{opacity:.8;}
.aviz-anno-text{position:absolute;z-index:2147483638;cursor:pointer;transition:opacity .15s;}
.aviz-anno-text:hover{opacity:.8;}
.aviz-anno-resolved{opacity:.35;pointer-events:none;}
\`;
document.head.appendChild(sty);
`;
}