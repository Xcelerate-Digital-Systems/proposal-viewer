'use client';

import {
  ButtonHTMLAttributes,
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { SketchyFrame } from './SketchyFrame';
import { hashStringToInt } from './seed';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  seedKey: string;
  active?: boolean;
  tone?: 'default' | 'primary' | 'ghost';
}

export const SketchyButton = forwardRef<HTMLButtonElement, Props>(function SketchyButton(
  { seedKey, active = false, tone = 'default', className = '', children, ...rest },
  ref
) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const localRef = useRef<HTMLButtonElement | null>(null);
  const seed = hashStringToInt(seedKey);

  useLayoutEffect(() => {
    const el = localRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fill =
    tone === 'primary'
      ? active
        ? '#017C87'
        : '#E6F5F3'
      : active
      ? '#F1F1F1'
      : '#FAFAFA';
  const stroke = tone === 'primary' && active ? '#016670' : '#2B2B2B';

  return (
    <button
      ref={(node) => {
        localRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      className={`relative inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-sketch-ink hover:brightness-95 transition-[filter] ${
        tone === 'primary' && active ? 'text-white' : ''
      } ${className}`}
      {...rest}
    >
      {size.w > 0 && size.h > 0 && (
        <SketchyFrame
          w={size.w}
          h={size.h}
          variant="pill"
          seed={seed}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.4}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
});
