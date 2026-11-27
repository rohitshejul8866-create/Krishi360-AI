import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  CloudSun,
  ExternalLink,
  Globe,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Card, CardHeader } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { useAuth } from '../../context/AuthContext'
import { apiClient } from '../../services/apiClient'
import { useApp } from '../../services/store'
import type { GroundingSource } from '../../types'

interface LiveIntelligence {
  summary: string
  mandiUpdates: Array<{ crop: string; priceRange: string; trend: string }>
  weatherBrief: string
  pestAlert: string
  sources: string[]
  groundingSources?: GroundingSource[]
  searchQueries?: string[]
  modelUsed?: string
  generatedAt?: string
}

export function LiveGeminiIntelligenceCard() {
  const { user } = useAuth()
  const { farms } = useApp()
  const region = farms[0]?.location || user?.location || 'Nashik, Maharashtra'

  const [data, setData] = useState<LiveIntelligence | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLiveIntelligence = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiClient.baseUrl}/ai/live-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: LiveIntelligence
        error?: string | { message?: string }
      }
      if (!res.ok || !json.data) {
        const msg = typeof json.error === 'string' ? json.error : json.error?.message
        throw new Error(msg || 'Failed to fetch live agricultural briefing from Gemini')
      }
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach live Gemini intelligence service')
    } finally {
      setLoading(false)
    }
  }, [region])

  useEffect(() => {
    void fetchLiveIntelligence()
  }, [fetchLiveIntelligence])

  return (
    <Card className="border-forest/30 bg-gradient-to-br from-white via-soft-sage/30 to-white shadow-xl">
      <CardHeader
        title="Gemini Real-Time Agricultural Intelligence"
        description={`Live Google Search grounded briefing for ${region} powered by Gemini 4 Hydrogen.`}
        icon={<Sparkles className="text-amber-600" size={20} />}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={error ? 'warning' : 'success'} className="gap-1 font-bold text-[11px]">
              <Globe size={11} /> {error ? 'Live Search Unavailable' : 'Grounded Search Live'}
            </Badge>
            <button
              type="button"
              onClick={() => void fetchLiveIntelligence()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold text-forest shadow-xs hover:bg-sage/10 transition disabled:opacity-60"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Live AI
            </button>
          </div>
        }
      />

      <div className="space-y-6 p-6 pt-2">
        {loading && !data ? (
          <div className="flex h-40 items-center justify-center text-xs text-muted">
            <RefreshCw className="mr-2 animate-spin text-forest" size={16} /> Querying Gemini API with Google Search grounding…
          </div>
        ) : null}

        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={16} className="shrink-0 text-amber-700" />
              <div>
                <p className="font-bold">Live Gemini Search brief could not be loaded</p>
                <p className="mt-0.5 text-amber-900/90">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void fetchLiveIntelligence()}
              disabled={loading}
              className="rounded-xl bg-amber-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800"
            >
              Retry
            </button>
          </div>
        ) : null}

        {data ? (
          <>
            <div className="rounded-2xl bg-forest p-4 text-white shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-sage/90">
                  Gemini Real-Time Brief · {data.modelUsed ?? 'gemini-4-hydrogen'}
                </p>
                {data.generatedAt ? (
                  <p className="text-[10px] text-white/70">
                    Updated {new Date(data.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs font-medium leading-relaxed text-white/95">{data.summary}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-line/80 bg-white/80 p-4 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-ink">
                  <TrendingUp size={15} className="text-emerald-600" /> Live Mandi Updates
                </div>
                <div className="mt-3 space-y-2.5">
                  {data.mandiUpdates && data.mandiUpdates.length > 0 ? (
                    data.mandiUpdates.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between border-b border-line/50 pb-2 text-xs last:border-0 last:pb-0">
                        <div>
                          <p className="font-extrabold text-ink">{m.crop}</p>
                          <p className="text-[10px] text-muted">{m.priceRange}</p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{m.trend}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted">No mandi crop breakdown returned for this query.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-line/80 bg-white/80 p-4 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-ink">
                  <CloudSun size={15} className="text-amber-600" /> Meteorological Intel
                </div>
                <p className="mt-3 text-xs font-semibold leading-relaxed text-ink">{data.weatherBrief}</p>
                <div className="mt-4 flex items-center gap-1.5 rounded-xl bg-soft-sage/40 p-2.5 text-[11px] font-bold text-forest">
                  <CheckCircle2 size={13} /> Verify local IMD bulletin before spraying
                </div>
              </div>

              <div className="rounded-2xl border border-line/80 bg-white/80 p-4 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-ink">
                  <ShieldAlert size={15} className="text-amber-700" /> Crop Health & Pest Alert
                </div>
                <p className="mt-3 text-xs font-semibold leading-relaxed text-ink">{data.pestAlert}</p>
                <div className="mt-4 flex items-center gap-1.5 rounded-xl bg-amber-50 p-2.5 text-[11px] font-bold text-amber-900">
                  <ShieldAlert size={13} className="text-amber-700" /> Active scouting recommended
                </div>
              </div>
            </div>

            {data.groundingSources && data.groundingSources.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-line/80 pt-3 text-[11px] text-muted">
                <span className="font-bold text-forest">Google Search Grounded Sources:</span>
                {data.groundingSources.map((src, i) => (
                  <a
                    key={i}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-white/90 px-2.5 py-1 text-ink transition hover:border-forest hover:text-forest"
                  >
                    <span className="max-w-[200px] truncate">{src.title}</span>
                    <ExternalLink size={10} />
                  </a>
                ))}
              </div>
            ) : data.sources && data.sources.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-line/80 pt-3 text-[11px] text-muted">
                <span className="font-bold text-forest">Sources referenced:</span>
                {data.sources.map((src, i) => (
                  <span key={i} className="rounded-lg border border-line bg-white/90 px-2 py-0.5 text-ink">
                    {src}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  )
}
