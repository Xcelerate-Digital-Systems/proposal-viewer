'use client';

import { memo, useMemo } from 'react';
import { roughCircle } from './roughPath';

interface Props {
  size: number;
  seed: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
}

function SketchyPinImpl({
  size,
  seed,
  fill,
  stroke = '#2B2B2B',
  strokeWidth = 1.6,
  className,
}: Props) {
  const paths = useMemo(
    () =>
      roughCircle(size / 2, size / 2, size - strokeWidth * 2, {
        seed,
        roughness: 1.2,
        bowing: 0.5,
        stroke,
        strokeWidth,
        fill,
        fillStyle: 'solid',
        disableMultiStroke: true,
      }),
    [size, seed, fill, stroke, strokeWidth]
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
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

export const SketchyPin = memo(SketchyPinImpl);
