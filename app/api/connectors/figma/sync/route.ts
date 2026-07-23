// POST — Re-sync a Figma asset: re-render the frame and create a new version.
// Body: { reviewItemId }

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { decryptFigmaToken } from '@/lib/connectors/figma/token-crypto';
import { renderFrames } from '@/lib/connectors/figma/api';

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { reviewItemId } = await req.json();
  if (!reviewItemId) {
    return NextResponse.json({ error: 'reviewItemId is required' }, { status: 400 });
  }

  const sb = createServiceClient();

  // Fetch the item and verify ownership
  const { data: item } = await sb
    .from('review_items')
    .select('id, review_project_id, company_id, type, figma_file_key, figma_node_id, figma_frame_name, version')
    .eq('id', reviewItemId)
    .eq('company_id', auth.companyId)
    .single();

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }
  if (item.type !== 'figma' || !item.figma_file_key || !item.figma_node_id) {
    return NextResponse.json({ error: 'Item is not a Figma asset' }, { status: 400 });
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

  // Re-render the frame
  let rendered;
  try {
    rendered = await renderFrames(item.figma_file_key, [item.figma_node_id], token, 2);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to render frame';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (rendered.length === 0) {
    return NextResponse.json({ error: 'Frame not found in Figma file — it may have been deleted' }, { status: 404 });
  }

  // Download and store the new image
  const imgRes = await fetch(rendered[0].imageUrl);
  if (!imgRes.ok) {
    return NextResponse.json({ error: 'Failed to download rendered image' }, { status: 502 });
  }
  const buffer = Buffer.from(await (await imgRes.blob()).arrayBuffer());

  const storagePath = `reviews/${auth.companyId}/${item.review_project_id}/figma-${item.figma_node_id.replace(/:/g, '-')}-${Date.now()}.png`;
  const { error: uploadError } = await sb.storage
    .from('company-assets')
    .upload(storagePath, buffer, { contentType: 'image/png' });

  if (uploadError) {
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }

  const { data: urlData } = sb.storage
    .from('company-assets')
    .getPublicUrl(storagePath);

  const newVersionNumber = item.version + 1;

  // Create a new version row
  const { data: version, error: versionError } = await sb
    .from('review_item_versions')
    .insert({
      review_item_id: item.id,
      company_id: auth.companyId,
      version_number: newVersionNumber,
      notes: `Synced from Figma`,
      image_url: urlData.publicUrl,
      figma_file_key: item.figma_file_key,
      figma_node_id: item.figma_node_id,
      figma_frame_name: item.figma_frame_name,
      created_by: auth.member.user_id,
    })
    .select('id')
    .single();

  if (versionError || !version) {
    return NextResponse.json({ error: 'Failed to create version' }, { status: 500 });
  }

  // Update the item to point to the new version
  await sb
    .from('review_items')
    .update({
      version: newVersionNumber,
      active_version_id: version.id,
      image_url: urlData.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id);

  return NextResponse.json({
    success: true,
    data: { versionId: version.id, versionNumber: newVersionNumber, imageUrl: urlData.publicUrl },
  });
}
