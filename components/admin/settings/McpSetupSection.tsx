// components/admin/settings/McpSetupSection.tsx
'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';

const CAPABILITIES = [
  { name: 'Proposals', desc: 'List, create, and manage proposals' },
  { name: 'Quotes', desc: 'Build and update quotes with line items' },
  { name: 'Documents', desc: 'Create and edit documents and pages' },
  { name: 'Templates', desc: 'Browse and apply templates' },
  { name: 'Campaigns', desc: 'Manage campaign projects and assets' },
  { name: 'Clients', desc: 'Access client company records' },
  { name: 'Team', desc: 'View team members and roles' },
  { name: 'Funnels', desc: 'View funnel plans and forecasts' },
  { name: 'Swipe Vault', desc: 'Browse swipe file collections' },
];

export default function McpSetupSection() {
  const [copied, setCopied] = useState(false);
  const [showCapabilities, setShowCapabilities] = useState(false);

  const appUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'https://app.agencyviz.io';

  const serverUrl = `${appUrl}/api/mcp`;

  const configJson = `{
  "mcpServers": {
    "agencyviz": {
      "url": "${serverUrl}"
    }
  }
}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(configJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="text-sm text-muted leading-relaxed">
        <p>
          Connect AI assistants like Claude, Cursor, or Windsurf to your AgencyViz workspace
          using the{' '}
          <a
            href="https://modelcontextprotocol.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal hover:underline inline-flex items-center gap-1"
          >
            Model Context Protocol
            <ExternalLink size={12} />
          </a>.
          Once connected, your AI tools can read and manage your proposals, quotes,
          campaigns, and more — directly from the chat.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 w-5 h-5 rounded-full bg-teal-tint text-teal text-xs font-semibold flex items-center justify-center shrink-0">1</span>
          <p className="text-sm text-ink">
            Add this config to your AI tool&apos;s MCP settings
          </p>
        </div>
      </div>

      {/* Config block */}
      <div className="relative rounded-lg border border-edge overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-paper border-b border-edge">
          <span className="text-xs font-medium text-muted">MCP Configuration</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors"
          >
            {copied ? <Check size={13} className="text-positive" /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="px-4 py-3 text-xs leading-relaxed overflow-x-auto bg-surface text-ink font-mono">
          {configJson}
        </pre>
      </div>

      {/* Step 2 */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-5 h-5 rounded-full bg-teal-tint text-teal text-xs font-semibold flex items-center justify-center shrink-0">2</span>
        <p className="text-sm text-ink">
          Restart your AI tool — it will open a browser window to authorise access to your workspace
        </p>
      </div>

      {/* OAuth note */}
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-teal-tint/50 border border-teal/20">
        <ShieldCheck size={15} className="text-teal mt-0.5 shrink-0" />
        <p className="text-xs text-muted leading-relaxed">
          Authentication is handled automatically via OAuth 2.0 with PKCE — no API keys to manage.
          Your AI tool registers itself, opens a browser for you to approve access, and refreshes
          tokens automatically.
        </p>
      </div>

      {/* Where to add it */}
      <div className="rounded-lg border border-edge bg-paper p-4">
        <p className="text-xs font-medium text-ink mb-2">Where to paste this config:</p>
        <ul className="text-xs text-muted space-y-1.5">
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-muted shrink-0" />
            <span><span className="text-ink font-medium">Claude Desktop</span> — Settings → Developer → Edit Config</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-muted shrink-0" />
            <span><span className="text-ink font-medium">Claude Code</span> — run <code className="px-1 py-0.5 bg-surface rounded font-mono">claude mcp add agencyviz --url {serverUrl}</code></span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-muted shrink-0" />
            <span><span className="text-ink font-medium">Cursor</span> — Settings → MCP Servers → Add new</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-muted shrink-0" />
            <span><span className="text-ink font-medium">Windsurf</span> — Settings → MCP → Add Server</span>
          </li>
        </ul>
      </div>

      {/* Capabilities */}
      <button
        onClick={() => setShowCapabilities(!showCapabilities)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink transition-colors"
      >
        {showCapabilities ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Available capabilities
      </button>

      {showCapabilities && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CAPABILITIES.map(cap => (
            <div key={cap.name} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-paper border border-edge">
              <span className="w-1.5 h-1.5 rounded-full bg-teal mt-1.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-ink">{cap.name}</p>
                <p className="text-xs text-muted">{cap.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
