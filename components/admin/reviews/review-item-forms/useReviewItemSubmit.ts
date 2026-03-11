// components/admin/reviews/review-item-forms/useReviewItemSubmit.ts
'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

interface UseReviewItemSubmitOptions {
  reviewProjectId: string;
  companyId: string;
  userId: string | null;
  nextSortOrder: number;
  onSuccess: (newItemId?: string) => void;
  onClose: () => void;
}

export function useReviewItemSubmit({
  reviewProjectId,
  companyId,
  userId,
  nextSortOrder,
  onSuccess,
  onClose,
}: UseReviewItemSubmitOptions) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  /** Submit an item that doesn't require a file upload (email, sms, webpage). */
  const submitPayload = useCallback(
    async (payload: Record<string, unknown>) => {
      setUploading(true);
      try {
        const { data: newItem, error } = await supabase
          .from('review_items')
          .insert({
            review_project_id: reviewProjectId,
            company_id: companyId,
            sort_order: nextSortOrder,
            status: 'in_review',
            created_by: userId,
            ...payload,
          })
          .select('id')
          .single();

        if (error || !newItem) {
          toast.error('Failed to create item');
          setUploading(false);
          return;
        }

        toast.success('Item added');
        onSuccess(newItem.id);
        onClose();
      } catch {
        toast.error('Something went wrong');
        setUploading(false);
      }
    },
    [reviewProjectId, companyId, userId, nextSortOrder, toast, onSuccess, onClose],
  );

  /** Submit an item that requires a file upload (image, ad). */
  const submitWithFile = useCallback(
    async (payload: Record<string, unknown>, file: File) => {
      setUploading(true);
      try {
        const ext = file.name.split('.').pop() || 'png';
        const path = `reviews/${companyId}/${reviewProjectId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('company-assets')
          .upload(path, file, { contentType: file.type });

        if (uploadError) {
          toast.error('Failed to upload image');
          setUploading(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('company-assets')
          .getPublicUrl(path);

        const imageUrl = urlData.publicUrl;

        const fullPayload: Record<string, unknown> = {
          review_project_id: reviewProjectId,
          company_id: companyId,
          sort_order: nextSortOrder,
          status: 'in_review',
          created_by: userId,
          image_url: imageUrl,
          ...payload,
        };

        // For ads, also set ad_creative_url to the uploaded image
        if (payload.type === 'ad') {
          fullPayload.ad_creative_url = imageUrl;
        }

        const { error: insertError } = await supabase
          .from('review_items')
          .insert(fullPayload);

        if (insertError) {
          toast.error('Failed to create item');
          await supabase.storage.from('company-assets').remove([path]);
          setUploading(false);
          return;
        }

        toast.success('Item added');
        onSuccess();
        onClose();
      } catch {
        toast.error('Something went wrong');
        setUploading(false);
      }
    },
    [reviewProjectId, companyId, userId, nextSortOrder, toast, onSuccess, onClose],
  );

  return { uploading, submitPayload, submitWithFile };
}
