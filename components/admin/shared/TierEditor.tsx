// components/admin/shared/TierEditor.tsx
'use client';

import { GripVertical, ChevronDown, ChevronUp, Star, ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react';
import { PackageTier, PackageFeature } from '@/lib/supabase';
import ColorPickerField from '@/components/ui/ColorPickerField';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface TierEditorProps {
  tier: PackageTier;
  tierIdx: number;
  totalTiers: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (changes: Partial<PackageTier>) => void;
  onToggleRecommended: () => void;
  onMove: (dir: 'up' | 'down') => void;
  onRemove: () => void;
  onAddFeature: () => void;
  onUpdateFeature: (fi: number, changes: Partial<PackageFeature>) => void;
  onRemoveFeature: (fi: number) => void;
  onAddCondition: () => void;
  onUpdateCondition: (ci: number, val: string) => void;
  onRemoveCondition: (ci: number) => void;
  onAddChild: (fi: number) => void;
  onUpdateChild: (fi: number, ci: number, val: string) => void;
  onRemoveChild: (fi: number, ci: number) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TierEditor({
  tier, tierIdx, totalTiers, isExpanded, onToggleExpand,
  onUpdate, onToggleRecommended, onMove, onRemove,
  onAddFeature, onUpdateFeature, onRemoveFeature,
  onAddCondition, onUpdateCondition, onRemoveCondition,
  onAddChild, onUpdateChild, onRemoveChild,
}: TierEditorProps) {
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Tier header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-100 rounded-t-lg">
        <GripVertical size={14} className="text-gray-300 shrink-0" />
        <button onClick={onToggleExpand} className="flex-1 flex items-center gap-2 text-left min-w-0">
          <span className="text-xs font-medium text-gray-700 truncate">{tier.name || 'Unnamed'}</span>
          {isExpanded ? <ChevronUp size={12} className="text-gray-400 shrink-0 ml-auto" /> : <ChevronDown size={12} className="text-gray-400 shrink-0 ml-auto" />}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onMove('up')}
            disabled={tierIdx === 0}
            title="Move up"
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors text-gray-400"
          >
            <ArrowUp size={12} />
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={tierIdx === totalTiers - 1}
            title="Move down"
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors text-gray-400"
          >
            <ArrowDown size={12} />
          </button>
          <button
            onClick={onToggleRecommended}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              tier.is_recommended
                ? 'bg-amber-50 text-amber-500 hover:bg-amber-100'
                : 'text-gray-400 hover:bg-gray-200'
            }`}
          >
            <Star size={10} className={tier.is_recommended ? 'fill-current' : ''} />
            {tier.is_recommended ? 'Recommended' : 'Recommend'}
          </button>
          <button onClick={onRemove} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Tier body */}
      {isExpanded && (
        <div className="p-3 space-y-4">
          {/* Name + price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-400 mb-1">Package Name</label>
              <input type="text" value={tier.name} onChange={e => onUpdate({ name: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
                placeholder="Starter" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-400 mb-1">Price</label>
              <input type="number" value={tier.price} onChange={e => onUpdate({ price: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
                placeholder="0" />
            </div>
          </div>

          {/* Prefix + suffix */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-400 mb-1">Price Prefix</label>
              <input type="text" value={tier.price_prefix} onChange={e => onUpdate({ price_prefix: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
                placeholder="FROM" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-400 mb-1">Price Suffix</label>
              <input type="text" value={tier.price_suffix} onChange={e => onUpdate({ price_suffix: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
                placeholder="/month" />
            </div>
          </div>

          {/* Highlight color */}
          <div className="space-y-2 pt-1 border-t border-gray-100">
            <ColorPickerField
              label="Highlight Color"
              value={tier.highlight_color || ''}
              fallback="#017C87"
              onChange={(val) => onUpdate({ highlight_color: val || null })}
              onReset={() => onUpdate({ highlight_color: null })}
            />
          </div>

          {/* Conditions / Notes */}
          <div className="pt-1 border-t border-gray-100">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Conditions / Notes</label>
                <button onClick={onAddCondition} className="flex items-center gap-1 px-2 py-0.5 rounded border border-[#017C87]/30 text-xs text-[#017C87] hover:bg-[#017C87]/5 hover:border-[#017C87] transition-colors">
                  <Plus size={11} /> Add
                </button>
              </div>
              {tier.conditions.map((condition, ci) => (
                <div key={ci} className="flex gap-2">
                  <input
                    type="text"
                    value={condition}
                    onChange={e => onUpdateCondition(ci, e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#017C87]/20"
                    placeholder="* Minimum 3 month contract"
                  />
                  <button onClick={() => onRemoveCondition(ci)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="pt-1 border-t border-gray-100">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Features</label>
                <button onClick={onAddFeature} className="flex items-center gap-1 px-2 py-0.5 rounded border border-[#017C87]/30 text-xs text-[#017C87] hover:bg-[#017C87]/5 hover:border-[#017C87] transition-colors">
                  <Plus size={11} /> Add
                </button>
              </div>
              {tier.features.map((feature, fi) => (
                <div key={fi} className="space-y-1.5 pl-2 border-l-2 border-gray-100">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={feature.bold_prefix || ''}
                      onChange={e => onUpdateFeature(fi, { bold_prefix: e.target.value || null })}
                      className="w-28 px-2.5 py-1.5 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#017C87]/20"
                      placeholder="Bold prefix"
                    />
                    <input
                      type="text"
                      value={feature.text}
                      onChange={e => onUpdateFeature(fi, { text: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#017C87]/20"
                      placeholder="Feature description"
                    />
                    <button onClick={() => onAddChild(fi)} className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors" title="Add sub-feature">
                      <Plus size={11} />
                    </button>
                    <button onClick={() => onRemoveFeature(fi)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 size={10} />
                    </button>
                  </div>
                  {feature.children.map((child, ci) => (
                    <div key={ci} className="flex gap-2 pl-4">
                      <input
                        type="text"
                        value={child}
                        onChange={e => onUpdateChild(fi, ci, e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded border border-gray-100 text-xs focus:outline-none focus:ring-1 focus:ring-[#017C87]/20 bg-gray-50"
                        placeholder="Sub-feature"
                      />
                      <button onClick={() => onRemoveChild(fi, ci)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}