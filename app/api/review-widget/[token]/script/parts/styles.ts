// app/api/review-widget/[token]/script/parts/styles.ts

const ACCENT = '#017C87';
const FONT = `'Clash Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`;

export function stylesJS(apiBase: string): string {
  const fontBase = apiBase + '/fonts';
  return `
var sty=document.createElement("style");
sty.textContent=\`
@font-face{font-family:'Clash Grotesk';src:url('${fontBase}/ClashGrotesk-Variable.woff2') format('woff2');font-weight:200 700;font-style:normal;font-display:swap;}
#aviz-root,#aviz-root *{box-sizing:border-box;margin:0;padding:0;font-family:${FONT};line-height:1.4;}

/* ── Toolbar ───────────────────────────────────────────── */
#aviz-toolbar{position:fixed;right:20px;top:50%;transform:translateY(-50%);z-index:2147483640;
  display:flex;flex-direction:column;background:#fff;border-radius:16px;
  box-shadow:0 4px 24px rgba(0,0,0,.12),0 1px 4px rgba(0,0,0,.06);overflow:visible;
  border:1px solid rgba(0,0,0,.06);transition:right .25s cubic-bezier(.4,0,.2,1);}
.aviz-tool{position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;
  background:transparent;border:none;cursor:pointer;color:#666;transition:all .15s;}
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
.aviz-sep{width:100%;height:1px;background:#e5e7eb;flex-shrink:0;}
#aviz-toolbar.panel-open{right:360px;}
@media(max-width:480px){
  #aviz-toolbar{right:10px;}
  .aviz-tool{width:42px;height:42px;}
  #aviz-toolbar.panel-open{right:calc(100vw - 6px);}
}

/* ── Mode bar (top bar when pin/box/text active) ───────── */
#aviz-mode-bar{position:fixed;top:0;left:0;right:0;z-index:2147483642;background:${ACCENT};
  color:#fff;display:none;align-items:center;justify-content:center;gap:12px;padding:10px 16px;
  font-size:13px;font-weight:500;box-shadow:0 2px 12px rgba(0,0,0,.15);}
#aviz-mode-bar.show{display:flex;}
#aviz-mode-bar button{background:rgba(255,255,255,.2);color:#fff;border:none;border-radius:6px;
  padding:5px 14px;font-size:12px;cursor:pointer;font-weight:500;font-family:${FONT};transition:background .15s;}
#aviz-mode-bar button:hover{background:rgba(255,255,255,.3);}

/* ── Annotation form (floating card) ───────────────────── */
.aviz-pin-form{position:fixed;z-index:2147483643;width:300px;background:#fff;border-radius:12px;
  box-shadow:0 8px 40px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.06);padding:14px;
  animation:aviz-fadeIn .15s ease-out;}
@keyframes aviz-fadeIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
.aviz-pin-form h4{font-size:11px;font-weight:600;color:${ACCENT};text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;}

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
.aviz-ph{padding:12px 16px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.aviz-ph-left{display:flex;align-items:center;gap:8px;}
.aviz-ph-title{font-size:15px;font-weight:600;color:#111;}
.aviz-ph-dots{background:none;border:none;cursor:pointer;color:#9ca3af;font-size:18px;padding:2px 4px;
  border-radius:4px;transition:background .15s;line-height:1;}
.aviz-ph-dots:hover{background:#f3f4f6;}
.aviz-ph-close{width:28px;height:28px;border-radius:6px;border:none;background:transparent;color:#9ca3af;
  cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;}
.aviz-ph-close:hover{background:#f3f4f6;color:#6b7280;}

/* ── Tabs: Open / Resolved ─────────────────────────────── */
.aviz-tabs{display:flex;gap:0;padding:0 16px;border-bottom:1px solid #e5e7eb;flex-shrink:0;}
.aviz-tab{padding:10px 14px;font-size:13px;font-weight:500;color:#9ca3af;background:none;border:none;
  border-bottom:2px solid transparent;cursor:pointer;transition:all .15s;font-family:${FONT};
  display:flex;align-items:center;gap:6px;}
.aviz-tab:hover{color:#6b7280;}
.aviz-tab.active{color:#111;border-bottom-color:${ACCENT};}
.aviz-tab-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;
  border-radius:10px;font-size:11px;font-weight:600;padding:0 6px;}
.aviz-tab.active .aviz-tab-count{background:${ACCENT};color:#fff;}
.aviz-tab:not(.active) .aviz-tab-count{background:#f3f4f6;color:#9ca3af;}

/* ── Page label ────────────────────────────────────────── */
.aviz-page-label{padding:8px 16px;font-size:11px;color:#9ca3af;border-bottom:1px solid #f3f4f6;flex-shrink:0;}

/* ── Body ──────────────────────────────────────────────── */
.aviz-pb{flex:1;overflow-y:auto;padding:8px 12px;}
.aviz-pb::-webkit-scrollbar{width:4px;}
.aviz-pb::-webkit-scrollbar-track{background:transparent;}
.aviz-pb::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:2px;}

/* ── Footer ────────────────────────────────────────────── */
.aviz-pf{padding:12px 16px;border-top:1px solid #e5e7eb;flex-shrink:0;}
.aviz-footer-trigger{width:100%;text-align:left;padding:10px 12px;border-radius:8px;font-size:13px;
  color:#9ca3af;border:1px solid #e5e7eb;background:#fff;cursor:pointer;transition:border-color .15s;
  font-family:${FONT};}
.aviz-footer-trigger:hover{border-color:#d1d5db;}
.aviz-footer-bar{display:flex;align-items:center;justify-content:space-between;margin-top:8px;}
.aviz-footer-right{display:flex;align-items:center;gap:6px;}

/* ══════════════════════════════════════════════════════════
   THREAD CARD
   ══════════════════════════════════════════════════════════ */
.aviz-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:8px;
  transition:background .3s,box-shadow .3s;}
.aviz-card.highlight{background:#fefce8;box-shadow:0 0 0 2px #fbbf2440;}

/* Card header: author */
.aviz-card-head{display:flex;align-items:center;gap:8px;margin-bottom:4px;}
.aviz-card-author{font-size:13px;font-weight:600;color:#111;}
.aviz-card-team{font-size:9px;font-weight:600;text-transform:uppercase;padding:2px 6px;border-radius:4px;
  background:${ACCENT}12;color:${ACCENT};letter-spacing:.3px;}
.aviz-card-team.sm{font-size:8px;padding:1px 5px;}

/* Card content */
.aviz-card-content{font-size:13px;color:#374151;line-height:1.55;white-space:pre-wrap;word-break:break-word;
  margin-bottom:8px;}

/* Replies inside card */
.aviz-card-replies{border-top:1px solid #f3f4f6;padding-top:8px;margin-bottom:8px;}
.aviz-card-reply{margin-bottom:6px;}
.aviz-card-reply:last-child{margin-bottom:0;}
.aviz-card-reply-author{font-size:12px;font-weight:600;color:#111;margin-right:4px;}
.aviz-card-reply-time{font-size:10px;color:#9ca3af;}
.aviz-card-reply-text{font-size:12px;color:#4b5563;line-height:1.5;margin-top:1px;white-space:pre-wrap;word-break:break-word;}

/* Screenshot thumbnail + meta row */
.aviz-card-meta{display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;padding:8px;
  background:#f9fafb;border-radius:6px;}
.aviz-card-thumb{width:56px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #e5e7eb;
  cursor:pointer;flex-shrink:0;transition:opacity .15s;}
.aviz-card-thumb:hover{opacity:.8;}
.aviz-card-meta-info{display:flex;flex-direction:column;gap:1px;min-width:0;}
.aviz-card-meta-row{font-size:11px;color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

/* Time (no screenshot) */
.aviz-card-time{font-size:11px;color:#9ca3af;margin-bottom:8px;}

/* ── Card action bar ──────────────────────────────────── */
.aviz-card-bar{display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid #f3f4f6;}
.aviz-card-bar-left{display:flex;align-items:center;gap:8px;}
.aviz-card-bar-right{display:flex;align-items:center;gap:6px;}

.aviz-card-action{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#9ca3af;
  background:none;border:none;cursor:pointer;padding:4px 6px;border-radius:4px;transition:all .15s;
  font-family:${FONT};}
.aviz-card-action:hover{color:#6b7280;background:#f3f4f6;}

.aviz-card-resolve{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:500;
  color:#9ca3af;background:none;border:1px solid #e5e7eb;cursor:pointer;padding:5px 10px;border-radius:6px;
  transition:all .15s;font-family:${FONT};}
.aviz-card-resolve:hover{color:#059669;border-color:#059669;background:#ecfdf5;}

.aviz-card-reopen{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:500;
  color:#9ca3af;background:none;border:1px solid #e5e7eb;cursor:pointer;padding:5px 10px;border-radius:6px;
  transition:all .15s;font-family:${FONT};}
.aviz-card-reopen:hover{color:#d97706;border-color:#d97706;background:#fffbeb;}

/* ── Reply form (inline in card) ──────────────────────── */
.aviz-reply-form{padding:8px 0;margin-bottom:4px;}
.aviz-reply-input-row{display:flex;gap:6px;align-items:center;}

/* ── Empty / loading ──────────────────────────────────── */
.aviz-empty{text-align:center;padding:40px 16px;color:#9ca3af;font-size:13px;}
.aviz-empty-sub{font-size:12px;margin-top:4px;color:#d1d5db;}

/* ══════════════════════════════════════════════════════════
   FORM INPUTS  (shared by panel footer + annotation forms)
   ══════════════════════════════════════════════════════════ */
.aviz-inp{width:100%;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;
  color:#111;outline:none;transition:border-color .15s,box-shadow .15s;background:#fff;font-family:${FONT};}
.aviz-inp:focus{border-color:${ACCENT};box-shadow:0 0 0 3px ${ACCENT}20;}
.aviz-inp::placeholder{color:#9ca3af;}
.aviz-ta{width:100%;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;
  color:#111;outline:none;resize:none;min-height:56px;background:#fff;transition:border-color .15s,box-shadow .15s;font-family:${FONT};}
.aviz-ta:focus{border-color:${ACCENT};box-shadow:0 0 0 3px ${ACCENT}20;}
.aviz-ta::placeholder{color:#9ca3af;}

.aviz-cancel-btn{font-size:12px;padding:6px 12px;color:#9ca3af;background:none;border:none;cursor:pointer;
  font-family:${FONT};font-weight:500;transition:color .15s;border-radius:6px;}
.aviz-cancel-btn:hover{color:#6b7280;background:#f3f4f6;}

.aviz-post-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:6px;
  background:${ACCENT};color:#fff;font-size:12px;font-weight:600;border:none;cursor:pointer;
  font-family:${FONT};transition:background .15s;}
.aviz-post-btn:hover:not(:disabled){background:#015f68;}
.aviz-post-btn:disabled{opacity:.4;cursor:not-allowed;}
.aviz-post-btn.sm{padding:6px 8px;}

/* Legacy shared buttons (annotation form) */
.aviz-btn{padding:7px 14px;border-radius:8px;font-size:11px;font-weight:600;border:none;cursor:pointer;
  transition:opacity .15s,background .15s;font-family:${FONT};}
.aviz-btn:disabled{opacity:.4;cursor:not-allowed;}
.aviz-btn-p{background:${ACCENT};color:#fff;}.aviz-btn-p:hover:not(:disabled){opacity:.9;}
.aviz-btn-g{background:transparent;color:#9ca3af;}.aviz-btn-g:hover{color:#6b7280;}
.aviz-pf-row{display:flex;gap:6px;margin-top:8px;align-items:center;}

/* ── Screenshot overlay ────────────────────────────────── */
#aviz-ss-overlay{position:fixed;inset:0;z-index:2147483645;background:#000;display:none;flex-direction:column;}
#aviz-ss-overlay.show{display:flex;}
#aviz-ss-toolbar{position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:2147483646;
  display:flex;align-items:center;gap:2px;background:#fff;border-radius:12px;padding:4px;
  box-shadow:0 4px 20px rgba(0,0,0,.25);border:1px solid rgba(0,0,0,.06);}
.aviz-ss-tool{width:36px;height:36px;display:flex;align-items:center;justify-content:center;
  background:transparent;border:none;cursor:pointer;border-radius:8px;color:#555;transition:all .12s;}
.aviz-ss-tool:hover{background:#f0f0f0;color:#333;}
.aviz-ss-tool.active{background:${ACCENT};color:#fff;}
.aviz-ss-tool.danger:hover{background:#fee2e2;color:#ef4444;}
.aviz-ss-sep{width:1px;height:24px;background:#e5e7eb;margin:0 2px;flex-shrink:0;}
#aviz-ss-canvas-wrap{flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;cursor:crosshair;}
#aviz-ss-canvas-wrap canvas{display:block;max-width:100%;max-height:100%;}
#aviz-ss-form{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);z-index:2147483646;
  width:360px;background:#fff;border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,.25);
  padding:16px;display:none;animation:aviz-fadeIn .15s ease-out;}
#aviz-ss-form.show{display:block;}
#aviz-ss-form h4{font-size:12px;font-weight:600;color:#111;margin-bottom:10px;}

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