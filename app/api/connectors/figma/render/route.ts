// POST — Render Figma frames as PNGs, store in Supabase Storage, and create review_items.
// Body: { reviewProjectId, fileKey, fileName, frames: [{ nodeId, name }], figmaVersionId? }

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { decryptFigmaToken } from '@/lib/connectors/figma/token-crypto';
import { renderFrames } from '@/lib/connectors/figma/api';

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { reviewProjectId, fileKey, fileName, frames, figmaVersionId } = body;

  if (!reviewProjectId || !fileKey || !Array.isArray(frames) || frames.length === 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Verify the project belongs to this company
  const sb = createServiceClient();

  const { data: project } = await sb
    .from('review_projects')
    .select('id')
    .eq('id', reviewProjectId)
    .eq('company_id', auth.companyId)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // Get the user's Figma token
  const { data: connection } = await sb
    .from('figma_connections')
    .select('access_token_encrypted')
    .eq('company_id', auth.companyId)
    .eq('team_member_id', auth.member.id)
    .single();

  if (!connection) {
    return NextResponse.json({ error: 'No Figma connection' }, { status: 400 });
  }

  const token = decryptFigmaToken(connection.access_token_encrypted);

  // Render frames as PNGs at 2x scale
  const nodeIds = frames.map((f: { nodeId: string }) => f.nodeId);
  let rendered;
  try {
    rendered = await renderFrames(fileKey, nodeIds, token, 2);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to render frames';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Get the current max sort_order
  const { data: maxSort } = await sb
    .from('review_items')
    .select('sort_order')
    .eq('review_project_id', reviewProjectId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();
  let nextSort = (maxSort?.sort_order ?? 0) + 1;

  // Download each rendered image, store in Supabase Storage, create review_item
  const createdItems: Array<{ id: string; title: string; nodeId: string }> = [];

  for (const img of rendered) {
    const frameInfo = frames.find((f: { nodeId: string; name: string }) => f.nodeId === img.nodeId);
    const frameName = frameInfo?.name || img.nodeId;

    // Download the rendered PNG from Figma's temporary URL
    const imgRes = await fetch(img.imageUrl);
    if (!imgRes.ok) continue;
    const blob = await imgRes.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    // Store in Supabase Storage
    const storagePath = `reviews/${auth.companyId}/${reviewProjectId}/figma-${img.nodeId.replace(/:/g, '-')}-${Date.now()}.png`;
    const { error: uploadError } = await sb.storage
      .from('company-assets')
      .upload(storagePath, buffer, { contentType: 'image/png' });

    if (uploadError) continue;

    const { data: urlData } = sb.storage
      .from('company-assets')
      .getPublicUrl(storagePath);

    // Create the review_item
    const { data: newItem, error: insertError } = await sb
      .from('review_items')
      .insert({
        review_project_id: reviewProjectId,
        company_id: auth.companyId,
        title: frameName,
        type: 'figma',
        sort_order: nextSort++,
        status: 'internal_review',
        image_url: urlData.publicUrl,
        figma_file_key: fileKey,
        figma_node_id: img.nodeId,
        figma_file_name: fileName || null,
        figma_frame_name: frameName,
        figma_version_id: figmaVersionId || null,
        created_by: auth.member.user_id,
      })
      .select('id')
      .single();

    if (!insertError && newItem) {
      createdItems.push({ id: newItem.id, title: frameName, nodeId: img.nodeId });
    }
  }

  return NextResponse.json({
    success: true,
    data: { created: createdItems, total: createdItems.length },
  });
}
