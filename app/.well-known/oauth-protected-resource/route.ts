import { NextResponse } from 'next/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.agencyviz.io';

export function GET() {
  return NextResponse.json({
    resource: `${APP_URL}/api/mcp`,
    authorization_servers: [APP_URL],
    scopes_supported: ['campaigns:read', 'campaigns:write', 'proposals:read', 'documents:read', 'templates:read', 'swipe:read', 'funnels:read', 'workspace:read'],
    bearer_methods_supported: ['header'],
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version',
    },
  });
}
