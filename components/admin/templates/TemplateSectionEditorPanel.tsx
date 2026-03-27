// components/admin/templates/TemplateSectionEditorPanel.tsx
// Bottom-sheet editor panel for templates — uses template-specific pricing/packages tabs.
'use client';

import { X } from 'lucide-react';
import TemplatePricingTab from './TemplatePricingTab';
import TemplatePackagesTab from './TemplatePackagesTab';

export type TemplateActiveSection =
  | { type: 'pricing' }
  | { type: 'packages'; pageId: string }
  | { type: 'text'; pageId: string }
  | { type: 'cover' };

interface TemplateSectionEditorPanelProps {
  templateId: string;
  companyId: string;
  section: TemplateActiveSection;
  onClose: () => void;
}

export default function TemplateSectionEditorPanel({
  templateId,
  companyId,
  section,
  onClose,
}: TemplateSectionEditorPanelProps) {
  const title = sectionTitle(section);
  const base = `/templates/${templateId}`;

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end pointer-events-none">
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />

      <div className="relative pointer-events-auto flex flex-col bg-ivory border-t border-gray-200 shadow-2xl rounded-t-2xl" style={{ maxHeight: '60%' }}>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0 bg-white rounded-t-2xl">
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" aria-label="Close panel">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {section.type === 'pricing' && (
            <div className="p-5">
              <TemplatePricingTab templateId={templateId} companyId={companyId} />
            </div>
          )}
          {section.type === 'packages' && (
            <div className="p-5">
              <TemplatePackagesTab templateId={templateId} companyId={companyId} />
            </div>
          )}
          {(section.type === 'text' || section.type === 'cover') && (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-8">
              <p className="text-sm text-gray-500">
                Open the <strong>{title}</strong> tab to edit this section with the full editor.
              </p>
              <a
                href={`${base}/${section.type === 'cover' ? 'cover' : 'text-pages'}`}
                className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-[#01434A] transition-colors"
              >
                Open {title} Tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function sectionTitle(section: TemplateActiveSection): string {
  switch (section.type) {
    case 'pricing':  return 'Pricing';
    case 'packages': return 'Packages';
    case 'text':     return 'Text Page';
    case 'cover':    return 'Cover';
  }
}
