// Benchmark: Meta Graph API passthrough latency over long date ranges.
//
// Purpose: answer "can a stateless Vercel function return 12–24 months of daily
// per-ad insights within Vercel's timeout budget?" before committing to the
// pure-passthrough architecture for the AgencyViz Meta → Looker connector.
//
// Vercel timeouts: Hobby 10s, Pro 60s default, Pro + `maxDuration: 300` → 300s.
//
// Usage:
//   META_ACCESS_TOKEN='EAA...' \
//   META_AD_ACCOUNT_ID='act_1234567890' \
//   node scripts/benchmark-meta-passthrough.mjs

const META_API_VERSION = 'v21.0'
const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

const INSIGHT_FIELDS = [
  'campaign_id', 'campaign_name',
  'adset_id', 'adset_name',
  'ad_id', 'ad_name',
  'impressions', 'clicks', 'spend', 'reach',
  'cpm', 'cpc', 'ctr',
  'actions', 'cost_per_action_type',
  'purchase_roas',
  'inline_link_clicks', 'inline_link_click_ctr',
  'unique_inline_link_clicks', 'unique_inline_link_click_ctr',
  'frequency',
  'video_play_actions',
].join(',')

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID

if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
  console.error('Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID env vars.')
  process.exit(1)
}

async function fetchChunk(accountId, dateFrom, dateTo) {
  const rows = []
  let bytes = 0
  let pages = 0

  let url = `${BASE_URL}/${accountId}/insights?${new URLSearchParams({
    level: 'ad',
    fields: INSIGHT_FIELDS,
    time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
    time_increment: 1,
    limit: 500,
    access_token: ACCESS_TOKEN,
  })}`

  while (url) {
    const res = await fetch(url)
    const text = await res.text()
    bytes += text.length
    pages++

    if (!res.ok) {
      throw new Error(`Meta API ${res.status}: ${text.slice(0, 300)}`)
    }
    const json = JSON.parse(text)
    rows.push(...(json.data || []))
    url = json.paging?.next || null
  }

  return { rows, bytes, pages }
}

function dateChunks(dateFrom, dateTo, maxDays = 60) {
  const chunks = []
  let cursor = new Date(dateFrom)
  const end = new Date(dateTo)
  while (cursor <= end) {
    const chunkEnd = new Date(cursor)
    chunkEnd.setDate(chunkEnd.getDate() + maxDays - 1)
    if (chunkEnd > end) chunkEnd.setTime(end.getTime())
    chunks.push([cursor.toISOString().split('T')[0], chunkEnd.toISOString().split('T')[0]])
    cursor = new Date(chunkEnd)
    cursor.setDate(cursor.getDate() + 1)
  }
  return chunks
}

// Bounded parallelism — avoids slamming Meta with 13 simultaneous chunk requests.
async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = i++
      if (idx >= items.length) return
      results[idx] = await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return results
}

async function runSequential(accountId, dateFrom, dateTo) {
  const chunks = dateChunks(dateFrom, dateTo, 60)
  const start = performance.now()
  let totalRows = 0, totalBytes = 0, totalPages = 0
  for (const [from, to] of chunks) {
    const { rows, bytes, pages } = await fetchChunk(accountId, from, to)
    totalRows += rows.length
    totalBytes += bytes
    totalPages += pages
  }
  return {
    label: 'sequential',
    chunks: chunks.length,
    rows: totalRows,
    bytes: totalBytes,
    pages: totalPages,
    ms: Math.round(performance.now() - start),
  }
}

async function runParallel(accountId, dateFrom, dateTo, concurrency) {
  const chunks = dateChunks(dateFrom, dateTo, 60)
  const start = performance.now()
  const results = await mapPool(chunks, concurrency, ([from, to]) => fetchChunk(accountId, from, to))
  const totalRows = results.reduce((a, r) => a + r.rows.length, 0)
  const totalBytes = results.reduce((a, r) => a + r.bytes, 0)
  const totalPages = results.reduce((a, r) => a + r.pages, 0)
  return {
    label: `parallel(c=${concurrency})`,
    chunks: chunks.length,
    rows: totalRows,
    bytes: totalBytes,
    pages: totalPages,
    ms: Math.round(performance.now() - start),
  }
}

function fmt(r) {
  const mb = (r.bytes / 1024 / 1024).toFixed(2)
  return `${r.label.padEnd(16)} ${String(r.chunks).padStart(2)} chunks  ${String(r.pages).padStart(3)} pages  ${String(r.rows).padStart(6)} rows  ${mb.padStart(6)} MB  ${String(r.ms).padStart(6)} ms`
}

function subtractDays(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

async function main() {
  const today = new Date().toISOString().split('T')[0]
  const windows = [
    { label: '3 months',  from: subtractDays(90) },
    { label: '12 months', from: subtractDays(365) },
    { label: '24 months', from: subtractDays(730) },
  ]

  console.log(`Account: ${AD_ACCOUNT_ID}`)
  console.log(`Today:   ${today}\n`)

  for (const w of windows) {
    console.log(`═══ ${w.label} (${w.from} → ${today}) ═══`)
    try {
      const seq = await runSequential(AD_ACCOUNT_ID, w.from, today)
      console.log(fmt(seq))
      const par4 = await runParallel(AD_ACCOUNT_ID, w.from, today, 4)
      console.log(fmt(par4))
      const par8 = await runParallel(AD_ACCOUNT_ID, w.from, today, 8)
      console.log(fmt(par8))
      console.log(`speedup seq→parallel(4): ${(seq.ms / par4.ms).toFixed(2)}x\n`)
    } catch (err) {
      console.error(`  FAILED: ${err.message}\n`)
    }
  }

  console.log('Verdict:')
  console.log(' - 24mo parallel(4) < 30s → passthrough safe at 24mo cap (recommended)')
  console.log(' - 12mo parallel(4) < 30s → passthrough safe at 12mo cap')
  console.log(' - even 3mo > 20s → need a cache layer before shipping')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
