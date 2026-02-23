// components/admin/templates/useTemplateSectionHeaders.ts
import { useState, useRef, useEffect, useCallback } from 'react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

export type SectionHeader = {
  id: string;
  name: string;
  position: number; // relative to PDF pages, -1 = end
};

export function useTemplateSectionHeaders(templateId: string) {
  const confirm = useConfirm();
  const toast = useToast();

  const [sectionHeaders, setSectionHeaders] = useState<SectionHeader[]>([]);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Fetch
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const res = await fetch(`/api/templates/section-headers?template_id=${templateId}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setSectionHeaders(data);
        }
      } catch { /* no sections yet */ }
      setSectionsLoaded(true);
    };
    fetchSections();
  }, [templateId]);

  // Save
  const saveSectionHeaders = useCallback(async (headers: SectionHeader[]) => {
    try {
      await fetch('/api/templates/section-headers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId, section_headers: headers }),
      });
    } catch {
      toast.error('Failed to save section headers');
    }
  }, [templateId, toast]);

  const debouncedSave = useCallback((headers: SectionHeader[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveSectionHeaders(headers), 500);
  }, [saveSectionHeaders]);

  const addSectionHeader = useCallback(() => {
    const id = crypto.randomUUID();
    const newHeader: SectionHeader = { id, name: 'New Section', position: -1 };
    const updated = [...sectionHeaders, newHeader];
    setSectionHeaders(updated);
    saveSectionHeaders(updated);
    toast.success('Section header added');
    return id;
  }, [sectionHeaders, saveSectionHeaders, toast]);

  const removeSectionHeader = useCallback(async (headerId: string) => {
    const ok = await confirm({
      title: 'Remove Section Header',
      message: 'Remove this section header from the template?',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return false;
    const updated = sectionHeaders.filter((h) => h.id !== headerId);
    setSectionHeaders(updated);
    saveSectionHeaders(updated);
    toast.success('Section header removed');
    return true;
  }, [confirm, sectionHeaders, saveSectionHeaders, toast]);

  const renameSectionHeader = useCallback((headerId: string, name: string) => {
    const updated = sectionHeaders.map((h) => h.id === headerId ? { ...h, name } : h);
    setSectionHeaders(updated);
    debouncedSave(updated);
  }, [sectionHeaders, debouncedSave]);

  return {
    sectionHeaders, setSectionHeaders, sectionsLoaded,
    saveSectionHeaders, addSectionHeader, removeSectionHeader, renameSectionHeader,
  };
}