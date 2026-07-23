import { NextResponse } from 'next/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.agencyviz.io';

export function GET() {
  return NextResponse.json({
    issuer: APP_URL,
    authorization_endpoint: `${APP_URL}/oauth/authorize`,
    token_endpoint: `${APP_URL}/api/oauth/token`,
    registration_endpoint: `${APP_URL}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post'],
    scopes_supported: ['campaigns:read', 'campaigns:write', 'proposals:read', 'documents:read', 'templates:read', 'swipe:read', 'funnels:read', 'workspace:read'],
    service_documentation: `${APP_URL}/docs/api`,
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
