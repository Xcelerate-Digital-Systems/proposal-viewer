// components/admin/ads/MetaSyncModal.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Check,
  CheckSquare,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Square,
  Video,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import CustomSelect, { type SelectOption } from './CustomSelect';

type Connection = {
  id: string;
  meta_user_id: string;
  meta_user_name: string | null;
  status: string;
  last_used_at: string | null;
};

type AdAccount = {
  connection_id: string;
  ad_account_id: string;
  account_name: string | null;
  business_name: string | null;
  enabled: boolean;
};

type ActiveAd = {
  meta_ad_id: string;
  name: string;
  effective_status: string;
  created_time: string | null;
  media_type: 'still' | 'video';
  image_url: string | null;
  thumbnail_url: string | null;
  video_source_url: string | null;
  primary_text: string | null;
  headline: string | null;
  description: string | null;
  cta_type: string | null;
  destination_url: string | null;
  all_primary_texts: string | null;
  all_headlines: string | null;
  all_descriptions: string | null;
  preview_url: string | null;
};

type ImportStatus = 'pending' | 'importing' | 'done' | 'error';
type ImportRow = { meta_ad_id: string; status: ImportStatus; error?: string };

type Step = 'picker' | 'selection' | 'importing';

type Props = {
  trackerId: string;
  onClose: () => void;
  onComplete: () => void;
};

export default function MetaSyncModal({ trackerId, onClose, onComplete }: Props) {
  const toast = useToast();

  const [step, setStep] = useState<Step>('picker');

  // Picker state
  const [connections, setConnections] = useState<Connection[]>([]);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Selection state
  const [ads, setAds] = useState<ActiveAd[]>([]);
  const [alreadyImported, setAlreadyImported] = useState<Set<string>>(new Set());
  const [loadingAds, setLoadingAds] = useState(false);
  const [loadError, setLoadError] = useState<{ message: string; reauth?: boolean } | null>(null);
  const [showAlreadyImported, setShowAlreadyImported] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Import state
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importFinished, setImportFinished] = useState(false);

  // Load connections on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (!token) return;
        const res = await fetch('/api/connectors/meta/accounts', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          const conns: Connection[] = json.data.connections ?? [];
          const accts: AdAccount[] = (json.data.accounts ?? []).filter((a: AdAccount) => a.enabled);
          setConnections(conns);
          setAccounts(accts);
          // Pre-select the account on the most-recently-used connection.
          if (accts.length > 0) {
            const lastUsedByConn = new Map(conns.map((c) => [c.id, c.last_used_at ?? '']));
            const sorted = [...accts].sort((a, b) => {
              const la = lastUsedByConn.get(a.connection_id) ?? '';
              const lb = lastUsedByConn.get(b.connection_id) ?? '';
              return lb.localeCompare(la);
            });
            setSelectedAccountId(sorted[0].ad_account_id);
          }
        }
      } finally {
        if (!cancelled) setConnectionsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const accountOptions: SelectOption[] = useMemo(
    () =>
      accounts.map((a) => {
        const biz = a.business_name ? `${a.business_name} — ` : '';
        const name = a.account_name ?? a.ad_account_id;
        return {
          value: a.ad_account_id,
          label: `${biz}${name}`,
          description: a.ad_account_id,
        };
      }),
    [accounts],
  );

  const fetchAds = async () => {
    if (!selectedAccountId) return;
    setLoadingAds(true);
    setLoadError(null);
    setAds([]);
    setAlreadyImported(new Set());
    setSelected(new Set());
    setStep('selection');
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('Not signed in');
      const url = `/api/connectors/meta/active-ads?ad_account_id=${encodeURIComponent(
        selectedAccountId,
      )}&tracker_id=${encodeURIComponent(trackerId)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const reauth = Boolean(json?.reauth_required);
        setLoadError({
          message: json?.error ?? `Failed to load ads (${res.status})`,
          reauth,
        });
        return;
      }
      const fetched: ActiveAd[] = json.data.ads ?? [];
      const imported: string[] = json.data.already_imported ?? [];
      setAds(fetched);
      setAlreadyImported(new Set(imported));
    } catch (e) {
      setLoadError({ message: e instanceof Error ? e.message : 'Failed to load ads' });
    } finally {
      setLoadingAds(false);
    }
  };

  const visibleAds = useMemo(() => {
    if (showAlreadyImported) return ads;
    return ads.filter((ad) => !alreadyImported.has(ad.meta_ad_id));
  }, [ads, alreadyImported, showAlreadyImported]);

  const selectableAds = useMemo(
    () => visibleAds.filter((ad) => !alreadyImported.has(ad.meta_ad_id)),
    [visibleAds, alreadyImported],
  );

  const toggleAd = (id: string) => {
    if (alreadyImported.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    const next = new Set(selected);
    selectableAds.forEach((ad) => next.add(ad.meta_ad_id));
    setSelected(next);
  };

  const clearSelection = () => setSelected(new Set());

  const runImport = async () => {
    const adsToImport = ads.filter((ad) => selected.has(ad.meta_ad_id));
    if (adsToImport.length === 0) return;

    setImportRows(adsToImport.map((ad) => ({ meta_ad_id: ad.meta_ad_id, status: 'pending' })));
    setImporting(true);
    setImportFinished(false);
    setStep('importing');

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('Not signed in');

      // Flip all to "importing" — the server handles the batch atomically
      // from the client's perspective, so we animate them together.
      setImportRows((prev) => prev.map((r) => ({ ...r, status: 'importing' })));

      const res = await fetch('/api/ads/creatives/sync-meta', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tracker_id: trackerId,
          ads: adsToImport.map((ad) => ({
            meta_ad_id: ad.meta_ad_id,
            meta_ad_account_id: selectedAccountId,
            name: ad.name,
            media_type: ad.media_type,
            image_url: ad.image_url,
            thumbnail_url: ad.thumbnail_url,
            video_source_url: ad.video_source_url,
            primary_text: ad.primary_text,
            headline: ad.headline,
            description: ad.description,
            cta_type: ad.cta_type,
            all_primary_texts: ad.all_primary_texts,
            all_headlines: ad.all_headlines,
            all_descriptions: ad.all_descriptions,
            destination_url: ad.destination_url,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json?.error ?? `Import failed (${res.status})`;
        setImportRows((prev) => prev.map((r) => ({ ...r, status: 'error', error: msg })));
        return;
      }

      // Map per-ad server results back onto the UI rows.
      const results: Array<{ meta_ad_id: string; id?: string; error?: string }> =
        json.data.results ?? [];
      const byId = new Map(results.map((r) => [r.meta_ad_id, r]));
      setImportRows((prev) =>
        prev.map((row) => {
          const result = byId.get(row.meta_ad_id);
          if (!result) return { ...row, status: 'error', error: 'No result' };
          if (result.id) return { ...row, status: 'done' };
          return { ...row, status: 'error', error: result.error ?? 'Failed' };
        }),
      );

      const succeeded = json.data.imported ?? 0;
      const failed = json.data.failed ?? 0;
      if (succeeded > 0 && failed === 0) {
        toast.success(`Imported ${succeeded} ad${succeeded !== 1 ? 's' : ''}`);
      } else if (succeeded > 0) {
        toast.info(`Imported ${succeeded}, ${failed} failed`);
      } else {
        toast.error(`All ${failed} imports failed`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      setImportRows((prev) => prev.map((r) => ({ ...r, status: 'error', error: msg })));
      toast.error(msg);
    } finally {
      setImporting(false);
      setImportFinished(true);
      onComplete();
    }
  };

  const handleClose = () => {
    if (importing) return; // don't let the user bail mid-import
    onClose();
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const hasConnection = connections.length > 0;
  const alreadyImportedCount = ads.filter((ad) => alreadyImported.has(ad.meta_ad_id)).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge shrink-0">
          <div>
            <h2 className="text-base font-semibold text-ink">Sync from Meta</h2>
            <p className="text-xs text-faint mt-0.5">
              Pull live ads from an ad account and import their creative
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={importing}
            className="text-faint hover:text-ink disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
          {step === 'picker' && (
            <PickerStep
              loaded={connectionsLoaded}
              hasConnection={hasConnection}
              accountOptions={accountOptions}
              selectedAccountId={selectedAccountId}
              onSelect={setSelectedAccountId}
            />
          )}

          {step === 'selection' && (
            <SelectionStep
              loadingAds={loadingAds}
              loadError={loadError}
              ads={visibleAds}
              alreadyImported={alreadyImported}
              alreadyImportedCount={alreadyImportedCount}
              showAlreadyImported={showAlreadyImported}
              onToggleShowImported={() => setShowAlreadyImported((v) => !v)}
              selected={selected}
              onToggleAd={toggleAd}
              onSelectAll={selectAllVisible}
              onClear={clearSelection}
              onRetry={fetchAds}
            />
          )}

          {step === 'importing' && (
            <ImportingStep
              rows={importRows}
              ads={ads}
              finished={importFinished}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center gap-2 px-6 py-4 border-t border-edge shrink-0 bg-white rounded-b-2xl">
          <div className="text-xs text-faint">
            {step === 'selection' && !loadingAds && !loadError && (
              <>
                {selected.size} selected · {selectableAds.length} available
                {alreadyImportedCount > 0 && !showAlreadyImported && (
                  <> · {alreadyImportedCount} already imported (hidden)</>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              disabled={importing}
              className="px-4 py-2 text-[13px] text-muted hover:text-ink disabled:opacity-40"
            >
              {step === 'importing' && importFinished ? 'Close' : 'Cancel'}
            </button>

            {step === 'picker' && hasConnection && (
              <button
                onClick={fetchAds}
                disabled={!selectedAccountId}
                className="px-4 py-2 bg-teal hover:bg-teal-hover disabled:opacity-50 text-white text-[13px] font-semibold rounded-lg flex items-center gap-2"
              >
                <RefreshCw size={14} />
                Fetch active ads
              </button>
            )}

            {step === 'selection' && !loadingAds && (
              <>
                <button
                  onClick={fetchAds}
                  className="px-3 py-2 text-[13px] text-muted hover:text-ink flex items-center gap-1.5"
                >
                  <RefreshCw size={14} />
                  Refresh
                </button>
                <button
                  onClick={runImport}
                  disabled={selected.size === 0}
                  className="px-4 py-2 bg-teal hover:bg-teal-hover disabled:opacity-40 text-white text-[13px] font-semibold rounded-lg"
                >
                  Import {selected.size > 0 ? selected.size : ''} ad{selected.size !== 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Step components ─────────────────────────────────────────────────────── */

function PickerStep({
  loaded,
  hasConnection,
  accountOptions,
  selectedAccountId,
  onSelect,
}: {
  loaded: boolean;
  hasConnection: boolean;
  accountOptions: SelectOption[];
  selectedAccountId: string;
  onSelect: (v: string) => void;
}) {
  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="text-teal animate-spin" />
      </div>
    );
  }

  if (!hasConnection) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <AlertCircle size={28} className="text-faint" />
        <div>
          <p className="text-sm font-semibold text-ink">No Meta connection</p>
          <p className="text-xs text-faint mt-1 max-w-xs">
            Connect a Meta account first to pull live ads into the tracker.
          </p>
        </div>
        <Link
          href="/integrations/looker-studio"
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-lg"
        >
          Connect Meta
          <ExternalLink size={14} />
        </Link>
      </div>
    );
  }

  if (accountOptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <AlertCircle size={28} className="text-faint" />
        <div>
          <p className="text-sm font-semibold text-ink">No ad accounts available</p>
          <p className="text-xs text-faint mt-1 max-w-xs">
            Your Meta connection is active but no ad accounts are enabled for it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-ink mb-1.5">Ad account</label>
        <CustomSelect
          value={selectedAccountId}
          options={accountOptions}
          onChange={onSelect}
          placeholder="Select an ad account"
          searchable={accountOptions.length > 6}
          clearable={false}
        />
      </div>
      <p className="text-xs text-faint">
        Fetches every ad on this account (active, paused, archived — all of it), newest first. You'll pick which ones to import on the next step.
      </p>
    </div>
  );
}

function SelectionStep({
  loadingAds,
  loadError,
  ads,
  alreadyImported,
  alreadyImportedCount,
  showAlreadyImported,
  onToggleShowImported,
  selected,
  onToggleAd,
  onSelectAll,
  onClear,
  onRetry,
}: {
  loadingAds: boolean;
  loadError: { message: string; reauth?: boolean } | null;
  ads: ActiveAd[];
  alreadyImported: Set<string>;
  alreadyImportedCount: number;
  showAlreadyImported: boolean;
  onToggleShowImported: () => void;
  selected: Set<string>;
  onToggleAd: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onRetry: () => void;
}) {
  if (loadingAds) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20">
        <Loader2 size={20} className="text-teal animate-spin" />
        <p className="text-xs text-faint">Loading active ads from Meta…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <AlertCircle size={28} className="text-red-500" />
        <div>
          <p className="text-sm font-semibold text-ink">
            {loadError.reauth ? 'Meta connection needs reauthorizing' : "Couldn't load ads"}
          </p>
          <p className="text-xs text-faint mt-1 max-w-md">{loadError.message}</p>
        </div>
        {loadError.reauth ? (
          <Link
            href="/integrations/looker-studio"
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-lg"
          >
            Reconnect Meta
            <ExternalLink size={14} />
          </Link>
        ) : (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-lg"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (ads.length === 0 && alreadyImportedCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
        <p className="text-sm font-semibold text-ink">No ads found</p>
        <p className="text-xs text-faint max-w-xs">
          This ad account doesn't have any ads to import.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onSelectAll}
            className="text-teal hover:underline font-medium"
          >
            Select all visible
          </button>
          <span className="text-edge">·</span>
          <button onClick={onClear} className="text-muted hover:text-ink">
            Clear
          </button>
        </div>
        {alreadyImportedCount > 0 && (
          <button
            onClick={onToggleShowImported}
            className="text-muted hover:text-ink"
          >
            {showAlreadyImported
              ? `Hide ${alreadyImportedCount} already imported`
              : `Show ${alreadyImportedCount} already imported`}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {ads.map((ad) => {
          const isImported = alreadyImported.has(ad.meta_ad_id);
          const isSelected = selected.has(ad.meta_ad_id);
          return (
            <button
              key={ad.meta_ad_id}
              type="button"
              onClick={() => onToggleAd(ad.meta_ad_id)}
              disabled={isImported}
              className={`w-full text-left flex gap-3 p-3 rounded-xl border transition-colors ${
                isImported
                  ? 'border-edge bg-surface opacity-60 cursor-not-allowed'
                  : isSelected
                  ? 'border-teal/50 bg-teal/5'
                  : 'border-edge bg-white hover:border-teal/40'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSelected && !isImported ? (
                  <CheckSquare size={18} className="text-teal" />
                ) : (
                  <Square size={18} className="text-faint" />
                )}
              </div>

              <div className="shrink-0 w-16 h-16 rounded-lg bg-surface border border-edge overflow-hidden flex items-center justify-center">
                {ad.thumbnail_url || ad.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ad.thumbnail_url ?? ad.image_url ?? ''}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : ad.media_type === 'video' ? (
                  <Video size={20} className="text-faint" />
                ) : (
                  <ImageIcon size={20} className="text-faint" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink truncate">{ad.name}</p>
                  {isImported && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal/10 text-teal border border-teal/20">
                      Imported
                    </span>
                  )}
                  <StatusPill status={ad.effective_status} />
                  {ad.media_type === 'video' && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface text-muted border border-edge">
                      Video
                    </span>
                  )}
                  {ad.created_time && (
                    <span className="shrink-0 text-[10px] text-faint">
                      {formatCreatedDate(ad.created_time)}
                    </span>
                  )}
                </div>
                {ad.headline && (
                  <p className="text-xs text-ink mt-1 truncate">
                    <span className="text-faint">H: </span>
                    {ad.headline}
                  </p>
                )}
                {ad.primary_text && (
                  <p className="text-xs text-muted mt-0.5 line-clamp-2">{ad.primary_text}</p>
                )}
                {(ad.all_headlines && ad.all_headlines.split(' | ').length > 1) && (
                  <p className="text-[11px] text-faint mt-1">
                    {ad.all_headlines.split(' | ').length} headline variants (Advantage+)
                  </p>
                )}
              </div>

              {ad.preview_url && !isImported && (
                <a
                  href={ad.preview_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 self-start text-faint hover:text-ink"
                  title="Open Meta preview"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ImportingStep({
  rows,
  ads,
  finished,
}: {
  rows: ImportRow[];
  ads: ActiveAd[];
  finished: boolean;
}) {
  const nameByAd = useMemo(() => new Map(ads.map((a) => [a.meta_ad_id, a.name])), [ads]);
  const done = rows.filter((r) => r.status === 'done').length;
  const errored = rows.filter((r) => r.status === 'error').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted">
        {finished ? (
          <>
            <ChevronRight size={14} />
            <span>
              {done} imported{errored > 0 ? ` · ${errored} failed` : ''}
            </span>
          </>
        ) : (
          <>
            <Loader2 size={14} className="text-teal animate-spin" />
            <span>Downloading assets and saving to the tracker…</span>
          </>
        )}
      </div>
      <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
        {rows.map((row) => (
          <div
            key={row.meta_ad_id}
            className="flex items-center gap-3 px-3 py-2 bg-surface rounded-lg text-xs"
          >
            <span className="flex-1 truncate text-ink">
              {nameByAd.get(row.meta_ad_id) ?? row.meta_ad_id}
            </span>
            <RowStatusIcon status={row.status} />
          </div>
        ))}
      </div>
      {errored > 0 && (
        <div className="space-y-1">
          {rows
            .filter((r) => r.status === 'error')
            .map((r) => (
              <p key={r.meta_ad_id} className="text-[11px] text-red-600">
                {nameByAd.get(r.meta_ad_id) ?? r.meta_ad_id}: {r.error ?? 'Failed'}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

function RowStatusIcon({ status }: { status: ImportStatus }) {
  if (status === 'pending') return <span className="w-4 h-4 rounded-full border border-edge" />;
  if (status === 'importing') return <Loader2 size={14} className="text-teal animate-spin" />;
  if (status === 'done') return <Check size={14} className="text-teal" />;
  return <AlertCircle size={14} className="text-red-600" />;
}

function StatusPill({ status }: { status: string }) {
  // Meta effective_status can be ACTIVE, PAUSED, ADSET_PAUSED, CAMPAIGN_PAUSED,
  // ARCHIVED, DELETED, IN_PROCESS, DISAPPROVED, WITH_ISSUES, and others.
  // Colour families keep the visual noise manageable.
  const s = status.toUpperCase();
  const isActive = s === 'ACTIVE';
  const isPaused = s.includes('PAUSED');
  const isArchived = s === 'ARCHIVED' || s === 'DELETED';
  const isIssue = s === 'DISAPPROVED' || s === 'WITH_ISSUES';

  const classes = isActive
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : isPaused
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : isArchived
    ? 'bg-surface text-faint border-edge'
    : isIssue
    ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-surface text-muted border-edge';

  const label = s.replace(/_/g, ' ').toLowerCase();
  return (
    <span
      className={`shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${classes}`}
    >
      {label}
    </span>
  );
}

function formatCreatedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
