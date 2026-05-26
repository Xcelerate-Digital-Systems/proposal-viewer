// components/ui/buttonClasses.ts
// Pure class-name helper for the Button primitive. Lives in its own file
// (no 'use client') so server components can import it to style <a> /
// next/link elements as buttons. The interactive Button component itself
// is in Button.tsx (client) and re-uses these constants.

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'ghost-on-dark'
  | 'danger'
  | 'danger-outline'
  | 'warning'
  | 'link';

export type ButtonSize = 'sm' | 'md' | 'lg';

export const buttonBaseClasses =
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none whitespace-nowrap';

export const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-white text-ink border border-edge hover:border-edge-hover hover:bg-paper',
  outline: 'bg-transparent text-primary border border-primary/30 hover:bg-primary-tint',
  ghost: 'bg-transparent text-ink hover:bg-edge',
  // For use on `surface-dark` backgrounds (sidebar, dark modals).
  'ghost-on-dark':
    'bg-transparent text-white/60 hover:text-white hover:bg-surface-dark-hover',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  // Subtle destructive — red text + thin red border, hover wash.
  'danger-outline':
    'bg-transparent text-red-600 border border-red-200 hover:bg-red-50',
  // Amber warning — for pending/needs-attention CTAs.
  warning: 'bg-amber-600 text-white hover:bg-amber-700',
  link: 'bg-transparent text-primary hover:underline px-0 h-auto rounded-none',
};

// Heights tuned to match the canonical sm/md/lg type scale.
// Icon sizes are exposed so leftIcon/rightIcon scale with the button.
export const buttonSizeMap: Record<
  ButtonSize,
  { cls: string; iconOnlyCls: string; icon: number }
> = {
  sm: { cls: 'h-8 px-3 text-xs', iconOnlyCls: 'h-8 w-8', icon: 14 },
  md: { cls: 'h-10 px-4 text-sm', iconOnlyCls: 'h-10 w-10', icon: 16 },
  lg: { cls: 'h-12 px-6 text-base', iconOnlyCls: 'h-12 w-12', icon: 20 },
};

export function buttonClasses(opts: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconOnly?: boolean;
  className?: string;
} = {}): string {
  const { variant = 'primary', size = 'md', fullWidth, iconOnly, className = '' } = opts;
  const sizeCls =
    variant === 'link' ? '' : iconOnly ? buttonSizeMap[size].iconOnlyCls : buttonSizeMap[size].cls;
  return [
    buttonBaseClasses,
    buttonVariantClasses[variant],
    sizeCls,
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}
