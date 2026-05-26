// components/ui/Button.tsx
// Canonical button primitive. Replaces inline <button> tags app-wide so the
// brand teal, sizing, and disabled/loading states stay consistent.
//
// For styling <a> / next/link as a button, import `buttonClasses` directly
// from './buttonClasses' (works in both server and client components).
'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  buttonClasses,
  buttonSizeMap,
  type ButtonVariant,
  type ButtonSize,
} from './buttonClasses';

// Re-export for callers that already do `import { buttonClasses } from '@/components/ui/Button'`.
// New code in server components should import from './buttonClasses' directly to avoid pulling
// this client module into their bundle.
export { buttonClasses };

interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  fullWidth?: boolean;
  /** Icon-only button (square padding). Pass the icon via `leftIcon` and put
   *  the accessible label in `aria-label`. */
  iconOnly?: boolean;
}

export type ButtonProps = ButtonOwnProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    fullWidth,
    iconOnly,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  const iconSize = buttonSizeMap[size].icon;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={buttonClasses({ variant, size, fullWidth, iconOnly, className })}
      {...rest}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin shrink-0" />
      ) : LeftIcon ? (
        <LeftIcon size={iconSize} className="shrink-0" />
      ) : null}
      {children}
      {!loading && RightIcon ? <RightIcon size={iconSize} className="shrink-0" /> : null}
    </button>
  );
});

export default Button;
