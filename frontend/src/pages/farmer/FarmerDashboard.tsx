import {
  ArrowRight,
  Bell,
  Bookmark,
  Boxes,
  CalendarDays,
  Droplets,
  MapPin,
  ScanSearch,
  Sprout,
  Store,
  Warehouse,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { StatCard } from '../../components/common/StatCard'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge, StatusPill } from '../../components/ui/Badge'
import { Progress } from '../../components/ui/Progress'
import { TrendChart } from '../../components/charts/TrendChart'
import { Reveal } from '../../components/animations/Reveal'
import { Stagger, StaggerItem } from '../../components/animations/Stagger'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../services/store'
import { DEMO_MANDI_PRICES, DEMO_PRICE_TREND } from '../../data/mandiPrices'
import { DEMO_WEATHER } from '../../data/irrigation'
import { formatDate, formatINR, relativeTime } from '../../services/utils'
import { WeatherMonitoringCard } from '../../components/farmer/WeatherMonitoringCard'
import { GrowthProjectionChart } from '../../components/farmer/GrowthProjectionChart'
import { LiveGeminiIntelligenceCard } from '../../components/farmer/LiveGeminiIntelligenceCard'

export function FarmerDashboard() {
  const { user } = useAuth()
  const {
    cases,
    farms,
    soilReadings,
    customCrops,
    savedSchemeIds,
    applications,
    storageBatches,
    notifications,
    mandiPrices,
  } = useApp()

  const activeFarm = farms[0]
  const farmPlots = activeFarm?.plots ?? []
  const totalAreaHa = activeFarm
    ? farmPlots.reduce((sum, plot) => sum + plot.areaHa, 0) || activeFarm.areaHa
    : 0
  const activeCropNames = Array.from(
    new Set([...farmPlots.map((plot) => plot.crop), ...customCrops]),
  )

  const farmerCases = cases.filter((item) => !user || item.farmerId === user.id)
  const activeCases = farmerCases.filter((item) => item.status !== 'resolved')
  const criticalBatches = storageBatches.filter((batch) => batch.status === 'critical')
  const visibleNotifications = notifications.filter(
    (item) => item.audience === 'farmer' || item.audience === 'all',
  )
  const unread = visibleNotifications.filter((item) => !item.read)
  const todaysPrice =
    mandiPrices.find((row) => row.crop === 'Tomato' && row.district === 'Nashik') ??
    DEMO_MANDI_PRICES.find((row) => row.crop === 'Tomato' && row.district === 'Nashik')
  const latestReading = soilReadings[0]

  return (
    <div>
      <PageHeader
        eyebrow="Farmer workspace"
        title={`Good morning, ${user?.name.split(' ')[0] ?? 'Farmer'}.`}
        description={`${activeFarm?.name ?? 'No farm registered yet'} · ${activeFarm?.location ?? user?.location ?? 'India'} · ${formatDate(new Date().toISOString(), { weekday: 'long' })}`}
        badge={<DemoNote label="Your saved workspace" />}
        actions={
          <>
            <Link to="/farmer/notifications" className="relative inline-flex items-center gap-2 rounded-2xl border border-line bg-white/70 px-4 py-2.5 text-xs font-bold text-forest hover:border-sage">
              <Bell size={15} /> Notifications
              {unread.length > 0 ? <span className="flex size-5 items-center justify-center rounded-full bg-alert text-[10px] text-white">{unread.length}</span> : null}
            </Link>
            <Link to="/farmer/crop-doctor" className="inline-flex items-center gap-2 rounded-2xl bg-forest px-4 py-2.5 text-xs font-bold text-white hover:bg-[#2b402c]">
              <ScanSearch size={15} /> New crop case
            </Link>
          </>
        }
      />

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: 'Total farm area',
            value: `${totalAreaHa.toFixed(1)} ha`,
            detail: `${farmPlots.length} plot${farmPlots.length === 1 ? '' : 's'} registered`,
            icon: MapPin,
          },
          {
            label: 'Active crops',
            value: activeCropNames.length,
            detail: `Across ${farmPlots.length} plot${farmPlots.length === 1 ? '' : 's'}`,
            icon: Sprout,
          },
          { label: 'Open crop cases', value: activeCases.length, detail: 'Including expert review', icon: ScanSearch, tone: 'forest' as const },
          { label: 'Storage batches', value: storageBatches.length, detail: `${criticalBatches.length} critical alert`, icon: Boxes, tone: criticalBatches.length ? ('alert' as const) : ('sage' as const) },
          { label: 'Saved schemes', value: savedSchemeIds.length, detail: `${applications.length} tracker active`, icon: Bookmark },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <StaggerItem key={stat.label}>
              <StatCard label={stat.label} value={stat.value} detail={stat.detail} icon={<Icon size={19} />} tone={'tone' in stat ? stat.tone : 'sage'} />
            </StaggerItem>
          )
        })}
      </Stagger>

      <div className="mt-6">
        <Reveal>
          <WeatherMonitoringCard />
        </Reveal>
      </div>

      <div className="mt-6">
        <Reveal>
          <GrowthProjectionChart />
        </Reveal>
      </div>

      <div className="mt-6">
        <Reveal>
          <LiveGeminiIntelligenceCard />
        </Reveal>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Reveal className="xl:col-span-2">
          <Card>
            <CardHeader
              title="Farm overview"
              description="Plot-level crop and moisture snapshot from your saved farm record."
              icon={<MapPin size={18} />}
              action={<Link to="/farmer/my-farm" className="inline-flex items-center gap-1 text-xs font-bold text-forest hover:underline">{farmPlots.length ? 'View farm' : 'Add farm plots'} <ArrowRight size={13} /></Link>}
            />
            {farmPlots.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {farmPlots.map((plot) => (
                  <div key={plot.id} className="rounded-2xl border border-line/70 bg-white/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-extrabold text-ink">{plot.name}</p>
                        <p className="mt-1 text-xs text-muted">{plot.crop} · {plot.areaHa} ha</p>
                      </div>
                      <StatusPill status={plot.status ?? 'healthy'} />
                    </div>
                    <p className="mt-4 text-[11px] font-bold text-muted">Growth stage: {plot.growthStage}</p>
                    <div className="mt-2"><Progress value={plot.soilMoisture ?? 35} label="Soil moisture" /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-soft-sage/35 p-6 text-center">
                <p className="text-sm font-bold text-ink">No plots saved yet</p>
                <p className="mt-1 text-xs text-muted">Add your farm details and plots in My Farm to track crops and soil moisture here.</p>
                <Link to="/farmer/my-farm" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-forest px-4 py-2 text-xs font-bold text-white hover:bg-[#2b402c]">
                  Add first plot <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </Card>
        </Reveal>

        <Reveal delay={0.1}>
          <Card>
            <CardHeader title="Crop health" description="Latest submitted cases and review state." icon={<ScanSearch size={18} />} />
            <div className="space-y-3">
              {farmerCases.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-2xl bg-soft-sage/40 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-extrabold text-ink">{item.id}</p>
                    <StatusPill status={item.reviewStatus} />
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-forest">{item.crop} · {item.condition}</p>
                  <p className="mt-1 text-[11px] text-muted">{relativeTime(item.submittedAt)} · {item.confidence}% confidence</p>
                </div>
              ))}
              {farmerCases.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">No crop cases submitted yet.</p>
              ) : null}
            </div>
            <Link to="/farmer/crop-doctor" className="mt-4 inline-flex items-center gap-2 text-xs font-extrabold text-forest hover:underline">Open CropDoctor AI <ArrowRight size={13} /></Link>
          </Card>
        </Reveal>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Reveal className="xl:col-span-2">
          <Card>
            <CardHeader
              title="Mandi intelligence"
              description="Sample modal price trend for Tomato at Nashik APMC."
              icon={<Store size={18} />}
              action={<DemoNote label="Not live prices" />}
            />
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <TrendChart data={DEMO_PRICE_TREND} xKey="day" yKey="price" name="Modal price (₹/qtl)" height={220} />
              <div className="space-y-3 rounded-2xl bg-soft-sage/50 p-4 sm:w-44">
                <div>
                  <p className="text-[10px] font-extrabold tracking-wide text-muted uppercase">Modal price</p>
                  <p className="text-xl font-extrabold text-ink">{formatINR(todaysPrice?.modalPrice ?? 1840)}</p>
                </div>
                <div className="border-t border-line pt-3">
                  <p className="text-[10px] font-extrabold tracking-wide text-muted uppercase">Trend</p>
                  <Badge tone="success">+{todaysPrice?.changePct ?? 4.2}% sample</Badge>
                </div>
                <p className="text-[10px] text-muted">Source: {todaysPrice?.source} · 21 Nov 2026</p>
              </div>
            </div>
            <Link to="/farmer/mandi-smart" className="mt-4 inline-flex items-center gap-2 text-xs font-extrabold text-forest hover:underline">Compare mandis <ArrowRight size={13} /></Link>
          </Card>
        </Reveal>

        <Reveal delay={0.08}>
          <Card>
            <CardHeader title="Irrigation overview" description="Saved soil readings and weather context." icon={<Droplets size={18} />} />
            <div className="space-y-4">
              {latestReading ? (
                <div className="rounded-2xl bg-soft-sage/50 p-4">
                  <p className="text-[10px] font-extrabold tracking-wide text-muted uppercase">Latest recommendation</p>
                  <p className="mt-2 text-sm font-extrabold text-forest">{latestReading.recommendation.headline}</p>
                  <p className="mt-1 text-xs text-muted">
                    Moisture {latestReading.soilMoisture}% · {latestReading.recommendation.bestWindow}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl bg-soft-sage/50 p-4">
                  <p className="text-[10px] font-extrabold tracking-wide text-muted uppercase">Next suggested action</p>
                  <p className="mt-2 text-sm font-extrabold text-ink">No soil readings logged yet</p>
                  <p className="mt-1 text-xs text-muted">Add a farm plot and log a soil reading in JalSense.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-line/70 p-3">
                  <p className="text-[10px] text-muted">Weather</p>
                  <p className="mt-1 text-sm font-extrabold text-ink">{DEMO_WEATHER.temperatureC}°C</p>
                </div>
                <div className="rounded-2xl border border-line/70 p-3">
                  <p className="text-[10px] text-muted">Rain chance</p>
                  <p className="mt-1 text-sm font-extrabold text-ink">{DEMO_WEATHER.forecastRainMm} mm</p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-extrabold tracking-wide text-muted uppercase">Recent readings</p>
                <div className="space-y-2">
                  {soilReadings.slice(0, 3).map((record) => (
                    <div key={record.id} className="flex items-center justify-between text-xs">
                      <span className="text-ink">{record.soilMoisture}% · {record.recommendation.action}</span>
                      <span className="text-muted">{formatDate(record.createdAt)}</span>
                    </div>
                  ))}
                  {soilReadings.length === 0 ? (
                    <p className="text-xs text-muted">No irrigation readings saved yet.</p>
                  ) : null}
                </div>
              </div>
            </div>
            <Link to="/farmer/jal-sense" className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-forest hover:underline">Open JalSense <ArrowRight size={13} /></Link>
          </Card>
        </Reveal>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Reveal>
          <Card>
            <CardHeader title="Storage monitoring" description="Saved grain batches and sensor status." icon={<Warehouse size={18} />} />
            <div className="space-y-3">
              {storageBatches.slice(0, 3).map((batch) => (
                <div key={batch.id} className="rounded-2xl border border-line/70 bg-white/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-extrabold text-ink">{batch.code} · {batch.crop}</p>
                    <StatusPill status={batch.status} />
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-muted">
                    <span>{batch.tempC}°C</span><span>{batch.humidity}% RH</span><span>{batch.location}</span>
                  </div>
                </div>
              ))}
              {storageBatches.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">No storage batches created yet.</p>
              ) : null}
            </div>
            <Link to="/farmer/grain-guard" className="mt-4 inline-flex items-center gap-2 text-xs font-extrabold text-forest hover:underline">Open GrainGuard <ArrowRight size={13} /></Link>
          </Card>
        </Reveal>

        <Reveal delay={0.08}>
          <Card>
            <CardHeader title="Scheme discovery" description="Saved schemes and application progress." icon={<Bookmark size={18} />} />
            <div className="space-y-4">
              {applications.slice(0, 2).map((app) => (
                <div key={app.id} className="rounded-2xl bg-soft-sage/45 p-4">
                  <p className="text-xs font-extrabold text-ink">{app.schemeId.replace('scheme-', 'Scheme ')} tracker</p>
                  <div className="mt-3"><Progress value={app.progress} label={app.stage} /></div>
                </div>
              ))}
              {applications.length === 0 ? <p className="text-xs text-muted">No application started yet.</p> : null}
            </div>
            <Link to="/farmer/scheme-saathi" className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-forest hover:underline">Find schemes <ArrowRight size={13} /></Link>
          </Card>
        </Reveal>

        <Reveal delay={0.16}>
          <Card>
            <CardHeader title="Recent activity" description="Latest events across your workspace." icon={<CalendarDays size={18} />} />
            <div className="relative space-y-4 pl-5">
              {visibleNotifications.length > 0 ? (
                <>
                  <span className="absolute top-2 bottom-2 left-1.5 w-px bg-line" />
                  {visibleNotifications.slice(0, 4).map((item) => (
                    <div key={item.id} className="relative">
                      <span className={`absolute -left-4.5 top-1.5 size-2.5 rounded-full border-2 border-white ${item.severity === 'critical' ? 'bg-alert' : 'bg-sage'}`} />
                      <p className="text-xs font-bold text-ink">{item.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted">{relativeTime(item.createdAt)}</p>
                    </div>
                  ))}
                </>
              ) : (
                <p className="py-4 text-xs text-muted">No notifications yet.</p>
              )}
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  )
}
