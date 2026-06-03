/**
 * Shared visual contract between the in-app feedback popovers (React components)
 * and the embedded widget script (vanilla JS + CSS string). Both read from here
 * so a tweak to the popover aesthetic propagates to both surfaces.
 *
 * React component usage:
 *   <div style={POPOVER_STYLE.container} className="bg-white rounded-xl border border-gray-200">
 *
 * Widget script usage (template literal interpolation):
 *   `.aviz-pin-form{width:${POPOVER_STYLE.widthPx}px;padding:${POPOVER_STYLE.paddingPx}px;...}`
 */
export const POPOVER_STYLE = {
  widthPx: 420,
  paddingPx: 22,
  borderRadiusPx: 14,
  borderColor: '#e5e7eb', // tailwind gray-200
  background: '#ffffff',
  boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)',
} as const;

/** Ready-to-spread into `style={{ ... }}` on a React div. */
export const POPOVER_INLINE_STYLE: React.CSSProperties = {
  boxShadow: POPOVER_STYLE.boxShadow,
};
