// components/admin/CustomDomainManager.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Globe, Loader2, CheckCircle2, AlertCircle, Copy,
  Trash2, RefreshCw, ExternalLink, Link2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DnsInstruction {
  type: string;
  name: string;
  value: string;
  instructions: string;
}

interface VercelVerification {
  type: string;
  domain: string;
  value: string;
  reason: string;
}

interface DomainState {
  custom_domain: string | null;
  domain_verified: boolean;
  vercel_status: {
    verified: boolean;
    verification: VercelVerification[];
  } | null;
}

interface CustomDomainManagerProps {
  companyId: string;
  isOwner: boolean;
}

export default function CustomDomainManager({ companyId, isOwner }: CustomDomainManagerProps) {
  const [domainState, setDomainState] = useState<DomainState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Input for new domain
  const [domainInput, setDomainInput] = useState('');

  // DNS instructions shown after adding a domain
  const [dnsInstructions, setDnsInstructions] = useState<DnsInstruction | null>(null);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token}` };
  };

  const fetchDomainStatus = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/company/domain?company_id=${companyId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setDomainState(data);
        if (data.custom_domain) {
          setDomainInput(data.custom_domain);
        }
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchDomainStatus();
  }, [fetchDomainStatus]);

  const showFeedback = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleAddDomain = async () => {
    if (!domainInput.trim()) return;
    setError('');
    setSaving(true);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/company/domain?company_id=${companyId}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domainInput.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add domain');
        setSaving(false);
        return;
      }

      setDomainState({
        custom_domain: data.custom_domain,
        domain_verified: data.domain_verified,
        vercel_status: {
          verified: data.domain_verified,
          verification: data.verification || [],
        },
      });
      setDnsInstructions(data.dns_instructions || null);
      showFeedback('Domain added — configure your DNS to connect it.');
    } catch {
      setError('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setError('');
    setVerifying(true);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/company/domain/verify?company_id=${companyId}`, {
        method: 'POST',
        headers,
      });

      const data = await res.json();
      if (data.verified) {
        setDomainState(prev => prev ? {
          ...prev,
          domain_verified: true,
          vercel_status: { verified: true, verification: [] },
        } : prev);
        setDnsInstructions(null);
        showFeedback('Domain verified and connected!');
      } else {
        setError('DNS not yet detected. It can take up to 48 hours to propagate. Try again shortly.');
        // Update verification challenges if returned
        if (data.verification?.length) {
          setDomainState(prev => prev ? {
            ...prev,
            vercel_status: {
              verified: false,
              verification: data.verification,
            },
          } : prev);
        }
      }
    } catch {
      setError('Verification check failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Remove custom domain? Proposal links using this domain will stop working.')) return;
    setError('');
    setRemoving(true);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/company/domain?company_id=${companyId}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        setDomainState({ custom_domain: null, domain_verified: false, vercel_status: null });
        setDomainInput('');
        setDnsInstructions(null);
        showFeedback('Custom domain removed');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to remove domain');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Link2 size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-500">Custom Domain</span>
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-gray-300" />
        </div>
      </div>
    );
  }

  const hasDomain = !!domainState?.custom_domain;
  const isVerified = domainState?.domain_verified ?? false;
  const isNewDomain = domainInput.trim().toLowerCase() !== (domainState?.custom_domain || '');

  // Build DNS instructions from state if not already set
  const effectiveDns = dnsInstructions || (hasDomain && !isVerified ? buildLocalDnsInstructions(domainState!.custom_domain!) : null);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link2 size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-500">Custom Domain</span>
        </div>
        {hasDomain && (
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
            isVerified
              ? 'bg-green-50 text-green-600'
              : 'bg-amber-50 text-amber-600'
          }`}>
            {isVerified ? (
              <><CheckCircle2 size={12} /> Connected</>
            ) : (
              <><AlertCircle size={12} /> Pending DNS</>
            )}
          </span>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Use your own domain for proposal links, e.g. <span className="text-gray-500">proposals.yourcompany.com</span>
      </p>

      {/* Domain input */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={domainInput}
          onChange={(e) => setDomainInput(e.target.value)}
          placeholder="proposals.yourcompany.com"
          disabled={!isOwner || saving}
          className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {isOwner && (
          <>
            {!hasDomain || isNewDomain ? (
              <button
                onClick={handleAddDomain}
                disabled={saving || !domainInput.trim()}
                className="px-4 py-2 bg-[#017C87] text-white text-sm rounded-lg hover:bg-[#01434A] disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : 'Connect'}
              </button>
            ) : null}
          </>
        )}
      </div>

      {/* Feedback messages */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-3">
          <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2.5 mb-3">
          <CheckCircle2 size={14} className="text-green-500 mt-0.5 shrink-0" />
          <p className="text-xs text-green-600">{success}</p>
        </div>
      )}

      {/* DNS Instructions — shown when domain is added but not verified */}
      {hasDomain && !isVerified && effectiveDns && (
        <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-4 mb-3">
          <h4 className="text-xs font-semibold text-amber-700 mb-2">DNS Configuration Required</h4>
          <p className="text-xs text-amber-600 mb-3">{effectiveDns.instructions}</p>

          <div className="bg-white rounded-lg border border-amber-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-amber-100">
                  <th className="text-left px-3 py-2 text-amber-500 font-medium">Type</th>
                  <th className="text-left px-3 py-2 text-amber-500 font-medium">Name</th>
                  <th className="text-left px-3 py-2 text-amber-500 font-medium">Value</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 font-mono text-gray-700">{effectiveDns.type}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">{effectiveDns.name}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">{effectiveDns.value}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleCopy(effectiveDns.value, 'dns')}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Copy value"
                    >
                      {copied === 'dns' ? <CheckCircle2 size={13} className="text-green-500" /> : <Copy size={13} />}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* TXT verification challenges from Vercel (if any) */}
          {domainState?.vercel_status?.verification?.length ? (
            <div className="mt-3">
              <p className="text-xs text-amber-600 mb-2">Vercel also requires this TXT record for verification:</p>
              <div className="bg-white rounded-lg border border-amber-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-amber-100">
                      <th className="text-left px-3 py-2 text-amber-500 font-medium">Type</th>
                      <th className="text-left px-3 py-2 text-amber-500 font-medium">Name</th>
                      <th className="text-left px-3 py-2 text-amber-500 font-medium">Value</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {domainState.vercel_status.verification.map((v, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-gray-700">{v.type}</td>
                        <td className="px-3 py-2 font-mono text-gray-700 break-all">{v.domain}</td>
                        <td className="px-3 py-2 font-mono text-gray-700 break-all max-w-[200px] truncate">{v.value}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleCopy(v.value, `txt-${i}`)}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Copy value"
                          >
                            {copied === `txt-${i}` ? <CheckCircle2 size={13} className="text-green-500" /> : <Copy size={13} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Verify button */}
          {isOwner && (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="mt-3 flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {verifying ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Check DNS Configuration
            </button>
          )}
        </div>
      )}

      {/* Verified state */}
      {hasDomain && isVerified && (
        <div className="bg-green-50/50 border border-green-100 rounded-lg p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-green-600" />
            <span className="text-xs font-semibold text-green-700">Domain Connected</span>
          </div>
          <p className="text-xs text-green-600 mb-2">
            Proposal links will use <span className="font-mono font-medium">{domainState?.custom_domain}</span>
          </p>
          <a
            href={`https://${domainState?.custom_domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#017C87] hover:underline"
          >
            Visit domain <ExternalLink size={11} />
          </a>
        </div>
      )}

      {/* Remove button */}
      {hasDomain && isOwner && (
        <button
          onClick={handleRemove}
          disabled={removing}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          {removing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          Remove custom domain
        </button>
      )}

      {!isOwner && !hasDomain && (
        <p className="text-xs text-gray-400">Only the company owner can configure a custom domain.</p>
      )}
    </div>
  );
}

// ─── Local helper ────────────────────────────────────────────────────────────
function buildLocalDnsInstructions(domain: string): DnsInstruction {
  const parts = domain.split('.');
  const isSubdomain = parts.length > 2;

  if (isSubdomain) {
    const subdomain = parts.slice(0, -2).join('.');
    return {
      type: 'CNAME',
      name: subdomain,
      value: 'cname.vercel-dns.com',
      instructions: `Add a CNAME record for "${subdomain}" pointing to "cname.vercel-dns.com" in your DNS provider.`,
    };
  } else {
    return {
      type: 'A',
      name: '@',
      value: '76.76.21.21',
      instructions: `Add an A record for "@" pointing to "76.76.21.21" in your DNS provider.`,
    };
  }
}