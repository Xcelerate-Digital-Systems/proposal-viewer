import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuth, unauthorized, txt, json, type McpServer } from '@/lib/mcp/types';

export function registerSwipeTools(server: McpServer) {
  server.tool('list_swipe_collections', 'List all swipe vault collections (naming conventions).', {
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('swipe_types')
      .select('id, name, description, sort_order, created_at')
      .eq('company_id', auth.companyId).order('sort_order', { ascending: true });
    if (error) return txt(`Error: ${error.message}`);
    if (!data?.length) return txt('No swipe collections found.');
    return json(data);
  });

  server.tool('list_swipe_files', 'List swipe files, optionally filtered by collection.', {
    collectionId: z.string().optional().describe('Filter by swipe type/collection ID'),
    mediaType: z.enum(['image', 'video', 'all']).optional(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ collectionId, mediaType, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    let q = sb.from('swipe_files')
      .select('id, title, headline, primary_text, description, cta, media_type, media_url, thumbnail_url, source_url, brand, notes, tags, type_id, transcription, created_at, updated_at')
      .eq('company_id', auth.companyId).order('sort_order', { ascending: true });
    if (collectionId) q = q.eq('type_id', collectionId);
    if (mediaType && mediaType !== 'all') q = q.eq('media_type', mediaType);
    const { data, error } = await q;
    if (error) return txt(`Error: ${error.message}`);
    if (!data?.length) return txt('No swipe files found.');
    return json(data.map(f => ({
      id: f.id, title: f.title, headline: f.headline, primaryText: f.primary_text, description: f.description,
      cta: f.cta, mediaType: f.media_type, mediaUrl: f.media_url, thumbnailUrl: f.thumbnail_url,
      sourceUrl: f.source_url, brand: f.brand, notes: f.notes, tags: f.tags, collectionId: f.type_id,
      transcription: f.transcription, updatedAt: f.updated_at,
    })));
  });

  server.tool('get_swipe_file', 'Get full detail of a single swipe file.', {
    swipeFileId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ swipeFileId, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: f } = await sb.from('swipe_files').select('*').eq('id', swipeFileId).eq('company_id', auth.companyId).single();
    if (!f) return txt('Swipe file not found');
    return json({
      id: f.id, title: f.title, headline: f.headline, primaryText: f.primary_text, description: f.description,
      cta: f.cta, mediaType: f.media_type, mediaUrl: f.media_url, thumbnailUrl: f.thumbnail_url,
      sourceUrl: f.source_url, brand: f.brand, notes: f.notes, tags: f.tags, collectionId: f.type_id,
      transcription: f.transcription, aiPrompt: f.ai_prompt, createdAt: f.created_at, updatedAt: f.updated_at,
    });
  });

  server.tool('create_swipe_collection', 'Create a new swipe vault collection (naming convention).', {
    name: z.string(),
    description: z.string().optional(),
    sortOrder: z.number().optional(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('swipe_types').insert({
      name: args.name, description: args.description || null,
      sort_order: args.sortOrder ?? 0, company_id: auth.companyId,
    }).select('id, name').single();
    if (error || !data) return txt(`Failed: ${error?.message || 'unknown'}`);
    return json({ id: data.id, name: data.name });
  });

  server.tool('update_swipe_collection', 'Update a swipe vault collection.', {
    collectionId: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    sortOrder: z.number().optional(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: c } = await sb.from('swipe_types').select('id').eq('id', args.collectionId).eq('company_id', auth.companyId).single();
    if (!c) return txt('Collection not found');
    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.sortOrder !== undefined) updates.sort_order = args.sortOrder;
    if (Object.keys(updates).length === 0) return txt('No fields to update.');
    const { error } = await sb.from('swipe_types').update(updates).eq('id', args.collectionId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt('Collection updated.');
  });

  server.tool('delete_swipe_collection', 'Delete a swipe vault collection. Files in it will become uncategorized.', {
    collectionId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ collectionId, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: c } = await sb.from('swipe_types').select('id, name').eq('id', collectionId).eq('company_id', auth.companyId).single();
    if (!c) return txt('Collection not found');
    await sb.from('swipe_files').update({ type_id: null }).eq('type_id', collectionId).eq('company_id', auth.companyId);
    const { error } = await sb.from('swipe_types').delete().eq('id', collectionId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt(`Collection "${c.name}" deleted.`);
  });

  server.tool('create_swipe_file', 'Create a new swipe file (ad creative reference).', {
    title: z.string(),
    collectionId: z.string().optional().describe('Swipe collection/type ID'),
    mediaType: z.enum(['image', 'video']).describe('Media type'),
    mediaUrl: z.string().describe('URL to the media file'),
    thumbnailUrl: z.string().optional(),
    headline: z.string().optional(),
    primaryText: z.string().optional(),
    description: z.string().optional(),
    cta: z.string().optional().describe('Call to action text'),
    sourceUrl: z.string().optional().describe('Original source URL'),
    brand: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('swipe_files').insert({
      title: args.title, type_id: args.collectionId || null,
      media_type: args.mediaType, media_url: args.mediaUrl,
      thumbnail_url: args.thumbnailUrl || null, headline: args.headline || null,
      primary_text: args.primaryText || null, description: args.description || null,
      cta: args.cta || null, source_url: args.sourceUrl || null,
      brand: args.brand || null, notes: args.notes || null,
      tags: args.tags || [], company_id: auth.companyId,
    }).select('id, title').single();
    if (error || !data) return txt(`Failed: ${error?.message || 'unknown'}`);
    return json({ id: data.id, title: data.title });
  });

  server.tool('update_swipe_file', 'Update a swipe file.', {
    swipeFileId: z.string(),
    title: z.string().optional(),
    collectionId: z.string().optional(),
    headline: z.string().optional(),
    primaryText: z.string().optional(),
    description: z.string().optional(),
    cta: z.string().optional(),
    mediaUrl: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    sourceUrl: z.string().optional(),
    brand: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: f } = await sb.from('swipe_files').select('id').eq('id', args.swipeFileId).eq('company_id', auth.companyId).single();
    if (!f) return txt('Swipe file not found');
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const MAP: [string, string][] = [
      ['title', 'title'], ['collectionId', 'type_id'], ['headline', 'headline'],
      ['primaryText', 'primary_text'], ['description', 'description'], ['cta', 'cta'],
      ['mediaUrl', 'media_url'], ['thumbnailUrl', 'thumbnail_url'],
      ['sourceUrl', 'source_url'], ['brand', 'brand'], ['notes', 'notes'], ['tags', 'tags'],
    ];
    let count = 0;
    for (const [param, col] of MAP) {
      const val = (args as Record<string, unknown>)[param];
      if (val !== undefined) { updates[col] = val; count++; }
    }
    if (count === 0) return txt('No fields to update.');
    const { error } = await sb.from('swipe_files').update(updates).eq('id', args.swipeFileId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt(`Swipe file updated (${count} field${count > 1 ? 's' : ''}).`);
  });

  server.tool('delete_swipe_file', 'Delete a swipe file.', {
    swipeFileId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ swipeFileId, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: f } = await sb.from('swipe_files').select('id, title').eq('id', swipeFileId).eq('company_id', auth.companyId).single();
    if (!f) return txt('Swipe file not found');
    const { error } = await sb.from('swipe_files').delete().eq('id', swipeFileId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt(`Swipe file "${f.title}" deleted.`);
  });
}
