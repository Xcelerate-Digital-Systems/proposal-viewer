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
  const thumbTranslate = trackW - thumbSize - thumbOffset * 2;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className="relative inline-flex shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        width: trackW,
        height: trackH,
        backgroundColor: enabled ? activeColor : '#D1D5DB',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        // focus-visible ring color
        // @ts-expect-error CSS custom property
        '--tw-ring-color': activeColor + '40',
      }}
    >
      <span
        className="inline-block rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{
          width: thumbSize,
          height: thumbSize,
          marginTop: thumbOffset,
          transform: `translateX(${enabled ? thumbTranslate : thumbOffset}px)`,
        }}
      />
    </button>
  );
}