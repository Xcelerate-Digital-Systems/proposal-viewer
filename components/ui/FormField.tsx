// components/ui/FormField.tsx
'use client';

import React from 'react';

/* ------------------------------------------------------------------ */
/*  Shared input class                                                 */
/* ------------------------------------------------------------------ */

export const inputClassName =
  'w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 placeholder:text-gray-400';

/* ------------------------------------------------------------------ */
/*  Field config type — reusable across all entity forms               */
/* ------------------------------------------------------------------ */

export interface FieldConfig {
  /** Form key / field name */
  key: string;
  /** Display label */
  label: string;
  /** Mark as required (shows asterisk, applies `required` attr) */
  required?: boolean;
  /** Input type — defaults to 'text' */
  type?: 'text' | 'email' | 'textarea';
  /** Placeholder text */
  placeholder?: string;
  /** Show "(optional)" after label */
  optional?: boolean;
  /** Render at half width (pair with next half-width field) */
  half?: boolean;
  /** Number of textarea rows — defaults to 2 */
  rows?: number;
}

/* ------------------------------------------------------------------ */
/*  FormField — single field                                           */
/* ------------------------------------------------------------------ */

interface FormFieldProps {
  /** Field configuration */
  config: FieldConfig;
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Disable the input */
  disabled?: boolean;
  /** Additional className on the wrapper div */
  className?: string;
}

export function FormField({ config, value, onChange, disabled, className }: FormFieldProps) {
  const { key, label, required, type = 'text', placeholder, optional, rows = 2 } = config;

  return (
    <div className={className}>
      <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {optional && <span className="text-gray-400 font-normal"> (optional)</span>}
      </label>
      {type === 'textarea' ? (
        <textarea
          id={key}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          className={`${inputClassName} resize-none`}
        />
      ) : (
        <input
          id={key}
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClassName}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FormFields — renders a list of fields with half-width pairing      */
/* ------------------------------------------------------------------ */

interface FormFieldsProps {
  /** Field configurations */
  fields: FieldConfig[];
  /** Current form values keyed by field key */
  values: Record<string, string>;
  /** Called when any field changes */
  onChange: (key: string, value: string) => void;
  /** Disable all inputs */
  disabled?: boolean;
}

export function FormFields({ fields, values, onChange, disabled }: FormFieldsProps) {
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < fields.length) {
    const f = fields[i];

    // Pair consecutive half-width fields into a 2-col grid
    if (f.half && i + 1 < fields.length && fields[i + 1].half) {
      const f2 = fields[i + 1];
      result.push(
        <div key={`${f.key}-${f2.key}`} className="grid grid-cols-2 gap-3">
          <FormField
            config={f}
            value={values[f.key] || ''}
            onChange={(v) => onChange(f.key, v)}
            disabled={disabled}
          />
          <FormField
            config={f2}
            value={values[f2.key] || ''}
            onChange={(v) => onChange(f2.key, v)}
            disabled={disabled}
          />
        </div>
      );
      i += 2;
    } else {
      result.push(
        <FormField
          key={f.key}
          config={f}
          value={values[f.key] || ''}
          onChange={(v) => onChange(f.key, v)}
          disabled={disabled}
        />
      );
      i += 1;
    }
  }

  return <>{result}</>;
}

/* ------------------------------------------------------------------ */
/*  Pre-defined field configs by entity type                           */
/* ------------------------------------------------------------------ */

export type EntityType = 'proposal' | 'template' | 'document';

export const fieldsByType: Record<EntityType, FieldConfig[]> = {
  proposal: [
    { key: 'title', label: 'Title', required: true, placeholder: 'e.g. Website Redesign Proposal' },
    { key: 'client_name', label: 'Client Name', required: true, placeholder: 'John Smith', half: true },
    { key: 'client_email', label: 'Client Email', type: 'email', placeholder: 'john@example.com', optional: true, half: true },
    { key: 'crm_identifier', label: 'CRM Identifier', placeholder: 'e.g. GHL contact ID', optional: true },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief note about this proposal...', optional: true },
  ],
  template: [
    { key: 'name', label: 'Template Name', required: true, placeholder: 'e.g. Standard Proposal Template' },
    { key: 'description', label: 'Description', placeholder: 'Brief description of this template', optional: true },
  ],
  document: [
    { key: 'title', label: 'Title', required: true, placeholder: 'e.g. Capabilities Statement' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief note about this document...', optional: true },
  ],
};