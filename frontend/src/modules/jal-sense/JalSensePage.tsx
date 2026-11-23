import { useMemo, useState } from 'react'
import { CalendarDays, CloudSun, Droplets, Gauge, Info, Timer, Wind } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Input'
import { TrendChart } from '../../components/charts/TrendChart'
import { DataTable } from '../../components/ui/Table'
import type { Column } from '../../components/ui/Table'
import { useApp } from '../../services/store'
import { useToast } from '../../context/ToastContext'
import { irrigationService } from '../../services/irrigationService'
import { DEMO_FARM } from '../../data/farmers'
import { CROP_NAMES, GROWTH_STAGES, SOIL_TYPES } from '../../data/crops'
import { DEMO_IRRIGATION_HISTORY, DEMO_WATER_USAGE, DEMO_WEATHER } from '../../data/irrigation'
import { formatDate, formatNumber } from '../../services/utils'
import type { IrrigationRecord } from '../../types'

const weatherOptions = ['Sunny', 'Partly cloudy', 'Hot & dry', 'Light rain', 'Cloudy']

export function JalSensePage() {
  const { farms, soilReadings, irrigationSchedules, toggleReminder, logSoilReading } = useApp()
  const { show } = useToast()
  const activeFarm = farms[0]
  const farmPlots = activeFarm?.plots ?? DEMO_FARM.plots
  const [plot, setPlot] = useState(farmPlots[0]?.name ?? DEMO_FARM.plots[0].name)
  const [crop, setCrop] = useState(farmPlots[0]?.crop ?? DEMO_FARM.plots[0].crop)
  const [stage, setStage] = useState(farmPlots[0]?.growthStage ?? DEMO_FARM.plots[0].growthStage)
  const [soilType, setSoilType] = useState(activeFarm?.soilType ?? DEMO_FARM.soilType)
  const [moisture, setMoisture] = useState(DEMO_FARM.plots[0].soilMoisture)
  const [weather, setWeather] = useState('Partly cloudy')
  const [temperature, setTemperature] = useState(DEMO_WEATHER.temperatureC)
  const [calculating, setCalculating] = useState(false)
  const [backendRecommendation, setBackendRecommendation] = useState<ReturnType<typeof irrigationService.recommend> | null>(null)

  const recommendation = useMemo(
    () => backendRecommendation ?? irrigationService.recommend({ plot, crop, stage, soilType, moisture, weather, temperature }),
    [backendRecommendation, plot, crop, stage, soilType, moisture, weather, temperature],
  )

  const columns: Column<IrrigationRecord>[] = [
    { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
    { key: 'plot', label: 'Plot / crop', render: (row) => <div><p className="font-bold text-ink">{row.crop}</p><p className="text-[11px] text-muted">{row.method}</p></div> },
    { key: 'duration', label: 'Duration', render: (row) => `${row.durationMin} min` },
    { key: 'water', label: 'Water', render: (row) => `${formatNumber(row.waterLitres)} L` },
    { key: 'moisture', label: 'Moisture', render: (row) => `${row.moistureBefore}% → ${row.moistureAfter}%` },
  ]

  const calculate = async () => {
    setCalculating(true)
    try {
      const targetFarmId = activeFarm?.id ?? 'farm-001'
      const matchedPlot = farmPlots.find((item) => item.name === plot) ?? farmPlots[0]
      const reading = await logSoilReading(targetFarmId, {
        plotId: matchedPlot?.id ?? 'plot-a',
        soilMoisture: Math.min(100, Math.max(0, moisture)),
        source: 'simulated',
        weather: { condition: weather, temperatureC: temperature },
      })
      setBackendRecommendation(reading.recommendation)
      show('Recommendation updated', 'Soil reading saved and processed by backend.', 'success')
    } catch {
      setBackendRecommendation(null)
      show('Recommendation updated', 'Inputs were processed by the demo irrigation model.', 'success')
    } finally {
      setCalculating(false)
    }
  }

  const actionTone = recommendation.action === 'irrigate-now' ? 'critical' : recommendation.action === 'schedule' ? 'warning' : 'success'

  return (
    <div>
      <PageHeader
        eyebrow="Module 03 · Water planning"
        title="JalSense"
        description="Understand a transparent, demo irrigation recommendation from crop, soil and simulated moisture inputs."
        badge={<DemoNote label="Simulated sensors" />}
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader title="Field inputs" description="Adjust values to see how the demo model responds." icon={<Gauge size={18} />} />
          <div className="space-y-4">
            <Field label="Plot">
              <Select value={plot} onChange={(event) => {
                const next = DEMO_FARM.plots.find((item) => item.name === event.target.value)
                setPlot(event.target.value)
                setBackendRecommendation(null)
                if (next) {
                  setCrop(next.crop)
                  setStage(next.growthStage)
                  setMoisture(next.soilMoisture)
                }
              }} options={farmPlots.map((item) => ({ value: item.name, label: item.name }))} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Crop">
                <Select value={crop} onChange={(event) => { setCrop(event.target.value); setBackendRecommendation(null) }} options={CROP_NAMES.map((name) => ({ value: name, label: name }))} />
              </Field>
              <Field label="Growth stage">
                <Select value={stage} onChange={(event) => { setStage(event.target.value); setBackendRecommendation(null) }} options={GROWTH_STAGES.map((name) => ({ value: name, label: name }))} />
              </Field>
              <Field label="Soil type">
                <Select value={soilType} onChange={(event) => { setSoilType(event.target.value); setBackendRecommendation(null) }} options={SOIL_TYPES.map((name) => ({ value: name, label: name }))} />
              </Field>
              <Field label="Soil moisture (%)">
                <Input type="number" min="0" max="100" value={moisture} onChange={(event) => { setMoisture(Number(event.target.value)); setBackendRecommendation(null) }} />
              </Field>
              <Field label="Weather context">
                <Select value={weather} onChange={(event) => { setWeather(event.target.value); setBackendRecommendation(null) }} options={weatherOptions.map((name) => ({ value: name, label: name }))} />
              </Field>
              <Field label="Temperature (°C)">
                <Input type="number" min="0" max="55" value={temperature} onChange={(event) => { setTemperature(Number(event.target.value)); setBackendRecommendation(null) }} />
              </Field>
            </div>
            <Button className="w-full" size="lg" onClick={() => void calculate()} disabled={calculating}>
              {calculating ? 'Calculating…' : 'Update recommendation'}
            </Button>
            {soilReadings.length > 0 ? (
              <p className="text-[11px] font-semibold text-forest">
                {soilReadings.length} soil reading{soilReadings.length === 1 ? '' : 's'} saved to backend this session.
              </p>
            ) : null}
            <p className="text-[10px] leading-relaxed text-muted">
              Sensor and weather values are illustrative. This model explains its logic and does not replace local agronomy advice.
            </p>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-soft-sage blur-2xl" />
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge tone={actionTone}>{recommendation.action.replace('-', ' ')}</Badge>
                  <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">{recommendation.headline}</h2>
                  <p className="mt-2 text-xs text-muted">{plot} · {crop} · {stage}</p>
                </div>
                <span className="flex size-12 items-center justify-center rounded-2xl bg-forest text-white"><Droplets size={22} /></span>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Droplets, label: 'Suggested water', value: `${formatNumber(recommendation.waterLitres)} L` },
                  { icon: Timer, label: 'Approx. duration', value: `${recommendation.durationMin} min` },
                  { icon: CloudSun, label: 'Best window', value: recommendation.bestWindow },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="rounded-2xl bg-soft-sage/50 p-4">
                      <Icon size={17} className="text-forest" />
                      <p className="mt-3 text-[10px] font-extrabold tracking-wide text-muted uppercase">{item.label}</p>
                      <p className="mt-1 text-sm font-extrabold text-ink">{item.value}</p>
                    </div>
                  )
                })}
              </div>
              <div className="mt-6">
                <h3 className="text-sm font-extrabold text-ink">How the demo reached this result</h3>
                <ol className="mt-3 space-y-2.5">
                  {recommendation.reasoning.map((reason, index) => (
                    <li key={reason} className="flex gap-3 text-xs leading-relaxed text-muted">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-forest">{index + 1}</span>
                      {reason}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="mt-6 flex items-start gap-2 rounded-2xl bg-[#FBF1DC] px-4 py-3 text-xs text-[#8A6520]">
                <Info size={15} className="mt-0.5 shrink-0" />
                {recommendation.confidenceNote}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Water usage" description="Simulated litres used over the last seven demo days." icon={<Droplets size={18} />} />
            <TrendChart data={DEMO_WATER_USAGE} xKey="day" yKey="litres" name="Litres" color="#344B35" height={210} />
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader title="Irrigation history" description="Logged demo irrigation events." icon={<CalendarDays size={18} />} />
          <DataTable columns={columns} rows={DEMO_IRRIGATION_HISTORY} rowKey={(row) => row.id} compact />
        </Card>
        <Card>
          <CardHeader title="Upcoming schedule" description="Toggle reminders for demo scheduling." icon={<CalendarDays size={18} />} />
          <div className="space-y-3">
            {irrigationSchedules.map((item) => (
              <div key={item.id} className="rounded-2xl border border-line/70 bg-white/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-ink">{item.plot}</p>
                    <p className="mt-1 text-[11px] text-muted">{item.crop} · {item.stage}</p>
                  </div>
                  <Badge tone="sage">{formatDate(item.nextDate)}</Badge>
                </div>
                <button
                  type="button"
                  onClick={() => { toggleReminder(item.id); show(item.reminder ? 'Reminder disabled' : 'Reminder enabled', item.plot, 'info') }}
                  className={`mt-4 w-full rounded-xl px-3 py-2 text-xs font-bold transition-colors ${item.reminder ? 'bg-forest text-white' : 'bg-soft-sage text-forest'}`}
                >
                  {item.reminder ? 'Reminder on · tap to disable' : 'Reminder off · tap to enable'}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-soft-sage/45 p-3 text-[11px] text-muted">
            <Wind size={14} className="text-forest" /> Weather context: {DEMO_WEATHER.condition}, {DEMO_WEATHER.forecastRainMm} mm expected rain ({DEMO_WEATHER.source}).
          </div>
        </Card>
      </div>
    </div>
  )
}
