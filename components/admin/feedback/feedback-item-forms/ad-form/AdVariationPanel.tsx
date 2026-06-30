'use client';

import { Plus } from 'lucide-react';
import { type PickerVariation } from './ad-form-types';
import { SortableExistingVariationRow, SortableNewVariationEditor } from './AdVariationRows';
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

export function AdVariationPanel({
  variations, setVariations, activeVariationId, setActiveVariationId,
  toggleVariation, patchVariation, addNewVariation, removeVariation, loadingExisting,
}: {
  variations: PickerVariation[];
  setVariations: React.Dispatch<React.SetStateAction<PickerVariation[]>>;
  activeVariationId: string | null;
  setActiveVariationId: (id: string) => void;
  toggleVariation: (id: string) => void;
  patchVariation: (id: string, patch: Partial<PickerVariation>) => void;
  addNewVariation: () => void;
  removeVariation: (id: string) => void;
  loadingExisting: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const existingVars = variations.filter((v) => v.isExisting);
  const newVars = variations.filter((v) => !v.isExisting);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setVariations((prev) => {
      const oldIdx = prev.findIndex((v) => v.id === active.id);
      const newIdx = prev.findIndex((v) => v.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const handleToggleExpand = (id: string, isExisting: boolean) => {
    if (isExisting) {
      const v = variations.find((x) => x.id === id);
      if (!v?.selected) toggleVariation(id);
    }
    if (activeVariationId === id) {
      setActiveVariationId('');
    } else {
      setActiveVariationId(id);
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
      <div className="p-5 flex-1">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-dim uppercase tracking-wider">
            Copy Variations
          </label>
          <button
            type="button"
            onClick={addNewVariation}
            className="inline-flex items-center gap-1 text-detail font-semibold text-teal hover:text-teal-hover"
          >
            <Plus size={12} />
            New variation
          </button>
        </div>
        <p className="text-detail text-faint mb-4">
          Select existing variations or create new ones. Drag to reorder.
        </p>

        {loadingExisting && (
          <div className="flex items-center gap-2 text-detail text-faint py-2">
            <div className="w-3 h-3 border border-faint border-t-teal rounded-full animate-spin" />
            Loading campaign variations…
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
          <SortableContext items={variations.map((v) => v.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2.5">
              {existingVars.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-2xs font-semibold uppercase tracking-wider text-dim">
                    Existing in this campaign
                  </p>
                  {existingVars.map((v) => (
                    <SortableExistingVariationRow
                      key={v.id}
                      variation={v}
                      isActive={activeVariationId === v.id}
                      onToggle={() => toggleVariation(v.id)}
                      onActivate={() => handleToggleExpand(v.id, true)}
                      onPatch={(patch) => patchVariation(v.id, patch)}
                    />
                  ))}
                </div>
              )}

              {newVars.length > 0 && (
                <div className="space-y-2.5">
                  {existingVars.length > 0 && (
                    <p className="text-2xs font-semibold uppercase tracking-wider text-dim mt-3">
                      New variations
                    </p>
                  )}
                  {newVars.map((v, i) => (
                    <SortableNewVariationEditor
                      key={v.id}
                      variation={v}
                      index={i}
                      isActive={activeVariationId === v.id}
                      onPatch={(patch) => patchVariation(v.id, patch)}
                      onActivate={() => handleToggleExpand(v.id, false)}
                      onRemove={() => removeVariation(v.id)}
                      canRemove={newVars.length > 1 || existingVars.filter((x) => x.selected).length > 0}
                    />
                  ))}
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
