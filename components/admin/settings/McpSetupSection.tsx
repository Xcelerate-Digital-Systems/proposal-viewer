// components/admin/settings/McpSetupSection.tsx
'use client';

import { useState, useCallback } from 'react';
import { Copy, Check, ExternalLink, ChevronDown, ChevronRight, ShieldCheck, Terminal } from 'lucide-react';

const CAPABILITIES = [
  { name: 'Proposals', desc: 'Create, edit, and manage proposals with full page CRUD' },
  { name: 'Quotes', desc: 'Build and update quotes with line items and packages' },
  { name: 'Documents', desc: 'Create, edit, and manage documents with full page CRUD' },
  { name: 'Templates', desc: 'Create, edit, and manage templates with full page CRUD' },
  { name: 'Campaigns', desc: 'Manage campaign projects, assets, versions, and comments' },
  { name: 'Clients', desc: 'Create and manage client company records' },
  { name: 'Team', desc: 'View team members and roles' },
  { name: 'Funnels', desc: 'Build and manage funnel plans with steps, edges, and forecasts' },
  { name: 'Swipe Vault', desc: 'Create and manage swipe file collections and references' },
];

type SetupTool = {
  name: string;
  icon: string;
  method: 'json' | 'cli' | 'url';
  instructions: string;
  value: string;
};

function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'md' }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 text-muted hover:text-ink transition-colors shrink-0 ${size === 'md' ? 'text-xs px-2 py-1 rounded border border-edge hover:bg-surface' : 'text-xs'}`}
    >
      {copied ? <Check size={13} className="text-positive" /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function McpSetupSection() {
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const appUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'https://app.agencyviz.io';

  const serverUrl = `${appUrl}/api/mcp`;

  const claudeCodeCmd = `claude mcp add --transport http agencyviz ${serverUrl}`;

  const tools: SetupTool[] = [
    {
      name: 'claude.ai',
      icon: '✦',
      method: 'url',
      instructions: 'Settings → Integrations → Add More → paste the URL below:',
      value: serverUrl,
    },
    {
      name: 'Claude Desktop',
      icon: '\u{1F5A5}',
      method: 'url',
      instructions: 'Settings → Developer → Add MCP Server → paste the URL below:',
      value: serverUrl,
    },
    {
      name: 'Claude Code',
      icon: '⌨',
      method: 'cli',
      instructions: 'Run this command in your terminal:',
      value: claudeCodeCmd,
    },
    {
      name: 'Cursor',
      icon: '▸',
      method: 'url',
      instructions: 'Settings → MCP Servers → Add new → paste the URL below:',
      value: serverUrl,
    },
  ];

  const activeTool = tools[activeTab];

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
          campaigns, and more &mdash; directly from the chat.
        </p>
      </div>

      {/* Setup card with tabs */}
      <div className="rounded-2xl border border-edge overflow-hidden bg-white">
        {/* Tool tabs */}
        <div className="flex border-b border-edge">
          {tools.map((tool, i) => (
            <button
              key={tool.name}
              onClick={() => setActiveTab(i)}
              className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors relative ${
                activeTab === i
                  ? 'text-ink bg-white'
                  : 'text-muted hover:text-ink bg-paper hover:bg-white'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <span>{tool.icon}</span>
                <span>{tool.name}</span>
              </span>
              {activeTab === i && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Active tool content */}
        <div className="p-4 space-y-3">
          {/* Step 1 */}
          <div className="flex items-start gap-3">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">1</span>
            <p className="text-sm text-ink">{activeTool.instructions}</p>
          </div>

          {/* Code/config block */}
          <div className="relative rounded-lg border border-edge overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-paper border-b border-edge">
              <span className="text-xs font-medium text-muted flex items-center gap-1.5">
                {activeTool.method === 'cli' ? <Terminal size={12} /> : null}
                {activeTool.method === 'cli' ? 'Terminal' : activeTool.method === 'url' ? 'Server URL' : 'JSON Config'}
              </span>
              <CopyButton text={activeTool.value} />
            </div>
            <pre className={`px-4 py-3 text-xs leading-relaxed overflow-x-auto bg-[#1e1e1e] text-[#d4d4d4] font-mono rounded-b-lg ${activeTool.method === 'url' ? 'select-all' : ''}`}>
              {activeTool.value}
            </pre>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">2</span>
            <p className="text-sm text-ink">
              {activeTool.method === 'cli'
                ? 'A browser window will open — approve access to your workspace'
                : 'Restart your AI tool — it will open a browser window to authorise access to your workspace'}
            </p>
          </div>
        </div>
      </div>

      {/* OAuth note */}
      <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-white border border-edge">
        <ShieldCheck size={15} className="text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted leading-relaxed">
          Authentication is handled automatically via OAuth 2.0 with PKCE &mdash; no API keys to manage.
          Your AI tool registers itself, opens a browser for you to approve access, and refreshes
          tokens automatically.
        </p>
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
            <div key={cap.name} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-white border border-edge">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
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
