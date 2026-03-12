// components/ui/CurrencyInput.tsx
'use client';

import { useRef } from 'react';

/* ------------------------------------------------------------------ */
/*  Size variants                                                       */
/*                                                                     */
/*  sm  — py-1.5 text-xs  — dense panels (TierEditor, LineItems)       */
/*  md  — py-2   text-sm  — standard forms (PaymentSchedule)           */
/* ------------------------------------------------------------------ */

type CurrencyInputSize = 'sm' | 'md';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  placeholder?: string;
  prefix?: string;
  size?: CurrencyInputSize;
  className?: string;
  disabled?: boolean;
}

const sizeStyles: Record<CurrencyInputSize, { input: string; prefix: string }> = {
  sm: {
    input:  'py-1.5 text-xs',
    prefix: 'text-xs',
  },
  md: {
    input:  'py-2 text-sm',
    prefix: 'text-sm',
  },
};

export default function CurrencyInput({
  value,
  onChange,
  onBlur,
  placeholder = '0.00',
  prefix = '$',
  size = 'md',
  className = '',
  disabled = false,
}: CurrencyInputProps) {
  const styles = sizeStyles[size];

  // Track raw string while user is typing so intermediate states like "1000."
  // don't get clobbered by a parseFloat round-trip.
  const rawRef = useRef<string | null>(null);

  const displayValue = rawRef.current !== null
    ? rawRef.current
    : value === 0 ? '' : String(value);

  return (
    <div className={`relative ${className}`}>
      <span
        className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none select-none ${styles.prefix}`}
      >
        {prefix}
      </span>
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={displayValue}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '');
          rawRef.current = raw;
          onChange(raw === '' ? 0 : parseFloat(raw) || 0);
        }}
        onFocus={(e) => {
          rawRef.current = null;
          e.target.select();
        }}
        onBlur={() => {
          rawRef.current = null;
          onBlur?.();
        }}
        className={[
          'w-full pl-7 pr-2.5 rounded border border-gray-200 text-right',
          'focus:outline-none focus:ring-1 focus:ring-teal/30 focus:border-teal/40',
          'placeholder:text-gray-300',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          styles.input,
        ].join(' ')}
      />
    </div>
  );
}