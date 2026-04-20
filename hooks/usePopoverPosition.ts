// hooks/usePopoverPosition.ts
'use client';

import { useMemo } from 'react';

/**
 * Compute absolute-positioning CSS for a popover anchored to a (pinX%, pinY%) point
 * inside a relative-positioned container. Flips horizontally near the right edge and
 * vertically near the bottom so the popover stays in view.
 */
export function usePopoverPosition(pinX: number, pinY: number): React.CSSProperties {
  return useMemo(() => {
    const style: React.CSSProperties = {
      position: 'absolute',
      zIndex: 50,
    };

    // Horizontal: place to the right of the pin if there's room, otherwise to the left.
    if (pinX < 60) {
      style.left = `calc(${pinX}% + 20px)`;
    } else {
      style.right = `calc(${100 - pinX}% + 20px)`;
    }

    // Vertical: anchor near top, bottom, or center based on pin position.
    if (pinY < 40) {
      style.top = `${pinY}%`;
    } else if (pinY > 60) {
      style.bottom = `${100 - pinY}%`;
    } else {
      style.top = `${pinY}%`;
      style.transform = 'translateY(-50%)';
    }

    return style;
  }, [pinX, pinY]);
}
