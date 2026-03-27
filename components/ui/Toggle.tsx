// components/ui/Toggle.tsx
'use client';

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  size?: 'sm' | 'md';
  activeColor?: string;
  disabled?: boolean;
}

export default function Toggle({
  enabled,
  onChange,
  size = 'md',
  activeColor = '#017C87',
  disabled = false,
}: ToggleProps) {
  const isSm = size === 'sm';
  const trackW = isSm ? 36 : 44;
  const trackH = isSm ? 20 : 24;
  const thumbSize = isSm ? 16 : 20;
  const thumbOffset = 2;
  // translateX moves from 0 (off) to (trackW - thumbSize - 2*thumbOffset) (on)
  // combined with marginLeft=thumbOffset this gives equal gaps on both sides
  const thumbTranslate = trackW - thumbSize - thumbOffset * 2;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className="relative inline-flex items-center shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        width: trackW,
        height: trackH,
        backgroundColor: enabled ? activeColor : '#CBD5E1',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        // @ts-expect-error CSS custom property
        '--tw-ring-color': activeColor + '40',
      }}
    >
      <span
        className="block rounded-full bg-white transition-transform duration-200"
        style={{
          width: thumbSize,
          height: thumbSize,
          marginLeft: thumbOffset,
          transform: `translateX(${enabled ? thumbTranslate : 0}px)`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.20), 0 1px 2px rgba(0,0,0,0.12)',
        }}
      />
    </button>
  );
}