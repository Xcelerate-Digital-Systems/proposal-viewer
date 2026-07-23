// GET — Fetch Figma file structure (pages + frames) for the frame picker.
// Query params: ?url=<figma_url>

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { decryptFigmaToken } from '@/lib/connectors/figma/token-crypto';
import { getFileStructure, getFrameThumbnails } from '@/lib/connectors/figma/api';
import { parseFigmaUrl } from '@/lib/connectors/figma/url-parser';

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'url parameter is required' }, { status: 400 });
  }

  const parsed = parseFigmaUrl(url);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid Figma URL' }, { status: 400 });
  }

  const sb = createServiceClient();

  const { data: connection } = await sb
    .from('figma_connections')
    .select('access_token_encrypted')
    .eq('company_id', auth.companyId)
    .eq('team_member_id', auth.member.id)
    .single();

  if (!connection) {
    return NextResponse.json({
      error: 'No Figma connection found. Connect your Figma account in Settings → Integrations first.',
    }, { status: 400 });
  }

  const token = decryptFigmaToken(connection.access_token_encrypted);

  try {
    const fileInfo = await getFileStructure(parsed.fileKey, token);

    const allNodeIds = fileInfo.pages.flatMap((p) => p.frames.map((f) => f.id));
    if (allNodeIds.length > 0) {
      const thumbnails = await getFrameThumbnails(parsed.fileKey, allNodeIds, token);
      const thumbMap = new Map(thumbnails.map((t) => [t.nodeId, t.imageUrl]));
      for (const page of fileInfo.pages) {
        for (const frame of page.frames) {
          frame.thumbnailUrl = thumbMap.get(frame.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        fileKey: parsed.fileKey,
        ...fileInfo,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Figma file';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
