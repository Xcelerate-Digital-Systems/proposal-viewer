'use client';

import { memo, useMemo } from 'react';
import rough from 'roughjs';
import type { Options } from 'roughjs/bin/core';

const generator = rough.generator();

export type SketchyVariant = 'card' | 'sticky' | 'icon' | 'pill';

interface Props {
  w: number;
  h: number;
  variant?: SketchyVariant;
  selected?: boolean;
  seed: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  roughness?: number;
  bowing?: number;
  className?: string;
}

function SketchyFrameImpl({
  w,
  h,
  variant = 'card',
  selected = false,
  seed,
  fill,
  stroke,
  strokeWidth,
  roughness,
  bowing,
  className,
}: Props) {
  const resolvedStroke = stroke ?? (selected ? '#017C87' : '#2B2B2B');
  const resolvedStrokeWidth = strokeWidth ?? (selected ? 2.2 : 1.6);

  const paths = useMemo(() => {
    const opts: Options = {
      seed,
      roughness: roughness ?? (variant === 'sticky' ? 1.8 : variant === 'pill' ? 1.0 : 1.3),
      bowing: bowing ?? (variant === 'sticky' ? 2 : 1),
      stroke: resolvedStroke,
      strokeWidth: resolvedStrokeWidth,
      fill,
      fillStyle: 'solid',
      disableMultiStroke: variant === 'pill',
    };
    const pad = 2;
    const drawW = Math.max(w - pad * 2, 1);
    const drawH = Math.max(h - pad * 2, 1);
    const drawable = generator.rectangle(pad, pad, drawW, drawH, opts);
    return generator.toPaths(drawable);
  }, [w, h, variant, seed, fill, resolvedStroke, resolvedStrokeWidth, roughness, bowing]);

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={`absolute inset-0 pointer-events-none ${className ?? ''}`}
      aria-hidden="true"
    >
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          stroke={p.stroke}
          strokeWidth={p.strokeWidth}
          fill={p.fill ?? 'none'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

export const SketchyFrame = memo(SketchyFrameImpl);
