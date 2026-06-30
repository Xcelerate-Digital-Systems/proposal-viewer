'use client';

// components/admin/connectors/ghl/GhlConnectionForm.tsx
//
// Disconnected-state form: API token + Location ID inputs and connect button.

import { Eye, EyeOff, Plug } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface GhlConnectionFormProps {
  token: string;
  setToken: (v: string) => void;
  locationId: string;
  setLocationId: (v: string) => void;
  showToken: boolean;
  setShowToken: (v: boolean) => void;
  connecting: boolean;
  onConnect: () => void;
}

export function GhlConnectionForm({
  token,
  setToken,
  locationId,
  setLocationId,
  showToken,
  setShowToken,
  connecting,
  onConnect,
}: GhlConnectionFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-faint">
          Connect your GoHighLevel account using a Private Integration token.
        </p>
        <div className="bg-surface border border-edge rounded-lg px-3 py-2.5 space-y-1.5">
          <p className="text-xs font-medium text-muted">Setup steps:</p>
          <ol className="text-detail text-faint list-decimal list-inside space-y-0.5">
            <li>In GHL, go to <span className="text-ink font-medium">Settings &rarr; Private Integrations &rarr; Create</span></li>
            <li>
              Add these scopes:
              <span className="inline-flex flex-wrap gap-1 ml-1">
                {['Locations (Read)', 'Opportunities (Read/Write)', 'Contacts (Read/Write)'].map(s => (
                  <span key={s} className="px-1.5 py-0.5 bg-surface border border-edge rounded text-2xs text-muted font-medium">{s}</span>
                ))}
              </span>
            </li>
            <li>Copy the <span className="text-ink font-medium">API Token</span> and paste it below</li>
          </ol>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1">API Token</label>
        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="w-full px-3 py-2 pr-10 text-sm border border-edge rounded-lg bg-surface text-ink placeholder:text-faint/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-muted"
            aria-label={showToken ? 'Hide token' : 'Show token'}
          >
            {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1">Location ID</label>
        <input
          type="text"
          value={locationId}
          onChange={e => setLocationId(e.target.value)}
          placeholder="GHL Location / Sub-Account ID"
          className="w-full px-3 py-2 text-sm border border-edge rounded-lg bg-surface text-ink placeholder:text-faint/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
        />
        <p className="text-detail text-faint mt-1">
          Found in GHL &rarr; Settings &rarr; Business Profile &rarr; look for the Location ID (starts with a long string of characters)
        </p>
      </div>

      <Button
        onClick={onConnect}
        loading={connecting}
        leftIcon={Plug}
      >
        Connect
      </Button>
    </div>
  );
}
