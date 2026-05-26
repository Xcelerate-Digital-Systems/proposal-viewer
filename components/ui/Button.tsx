// components/ui/Button.tsx
// Canonical button primitive. Replaces inline <button> tags app-wide so the
// brand teal, sizing, and disabled/loading states stay consistent.
//
// Also exports `buttonClasses()` for cases where you need an anchor or
// next/link styled like a button — pass the same opts and spread onto an <a>.
'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Variant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'ghost-on-dark'
  | 'danger'
  | 'danger-outline'
  | 'warning'
  | 'link';
type Size = 'sm' | 'md' | 'lg';

interface ButtonOwnProps {
  variant?: Variant;
  size?: Size;
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

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none whitespace-nowrap';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-white text-ink border border-edge hover:border-edge-hover hover:bg-paper',
  outline: 'bg-transparent text-primary border border-primary/30 hover:bg-primary-tint',
  ghost: 'bg-transparent text-ink hover:bg-edge',
  // For use on `surface-dark` backgrounds (sidebar, dark modals).
  'ghost-on-dark':
    'bg-transparent text-white/60 hover:text-white hover:bg-surface-dark-hover',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  // Subtle destructive — red text + thin red border, hover wash. Use when
  // solid `danger` is too aggressive (e.g. "Disconnect" in a settings list).
  'danger-outline':
    'bg-transparent text-red-600 border border-red-200 hover:bg-red-50',
  // Amber warning — for pending/needs-attention CTAs (e.g. "Check DNS
  // configuration" while a domain is unverified).
  warning: 'bg-amber-600 text-white hover:bg-amber-700',
  link: 'bg-transparent text-primary hover:underline px-0 h-auto rounded-none',
};

// Heights tuned to match the canonical sm/md/lg type scale.
// Icon sizes are returned alongside so leftIcon/rightIcon scale with the button.
const sizes: Record<Size, { cls: string; iconOnlyCls: string; icon: number }> = {
  sm: { cls: 'h-8 px-3 text-xs', iconOnlyCls: 'h-8 w-8', icon: 14 },
  md: { cls: 'h-10 px-4 text-sm', iconOnlyCls: 'h-10 w-10', icon: 16 },
  lg: { cls: 'h-12 px-6 text-base', iconOnlyCls: 'h-12 w-12', icon: 20 },
};

export function buttonClasses(opts: {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  iconOnly?: boolean;
  className?: string;
} = {}): string {
  const { variant = 'primary', size = 'md', fullWidth, iconOnly, className = '' } = opts;
  const sizeCls =
    variant === 'link' ? '' : iconOnly ? sizes[size].iconOnlyCls : sizes[size].cls;
  return [base, variants[variant], sizeCls, fullWidth ? 'w-full' : '', className]
    .filter(Boolean)
    .join(' ');
}

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
  const iconSize = sizes[size].icon;
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
