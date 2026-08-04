import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

export type { McpServer };

export type McpAuthInfo = AuthInfo & {
  companyId: string;
  userId: string;
  memberId: string;
  memberName: string;
  role: string;
  isSuperAdmin: boolean;
};

export function getAuth(extra: { authInfo?: AuthInfo }, companyIdOverride?: string): McpAuthInfo | null {
  if (!extra.authInfo) return null;
  const auth = extra.authInfo as McpAuthInfo;
  if (companyIdOverride && companyIdOverride !== auth.companyId) {
    if (!auth.isSuperAdmin) return null;
    return { ...auth, companyId: companyIdOverride };
  }
  return auth;
}

export function unauthorized() {
  return { content: [{ type: 'text' as const, text: 'Unauthorized — provide a valid Bearer token (av_live_*)' }] };
}

export function txt(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function json(data: unknown) {
  return txt(JSON.stringify(data, null, 2));
}
