import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CalendarPlus, CloudSun, Droplets, Gauge, Info, Timer, Wind } from 'lucide-react'
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
import { CROP_NAMES, GROWTH_STAGES, SOIL_TYPES } from '../../data/crops'
import { DEMO_WATER_USAGE, DEMO_WEATHER } from '../../data/irrigation'
import { formatDate, formatNumber } from '../../services/utils'
import type { BackendSoilReading } from '../../services/apiMappers'

const weatherOptions = ['Sunny', 'Partly cloudy', 'Hot & dry', 'Light rain', 'Cloudy']

export function JalSensePage() {
  const { farms, soilReadings, irrigationSchedules, addIrrigationSchedule, toggleReminder, logSoilReading } = useApp()
  const { show } = useToast()
  const activeFarm = farms[0]
  const farmPlots = useMemo(() => activeFarm?.plots ?? [], [activeFarm])
  const [plot, setPlot] = useState(farmPlots[0]?.name ?? 'Custom plot')
  const [crop, setCrop] = useState(farmPlots[0]?.crop ?? CROP_NAMES[0])
  const [stage, setStage] = useState(farmPlots[0]?.growthStage ?? GROWTH_STAGES[0])
  const [soilType, setSoilType] = useState(activeFarm?.soilType ?? SOIL_TYPES[0])
  const [moisture, setMoisture] = useState(farmPlots[0]?.soilMoisture ?? 35)
  const [weather, setWeather] = useState('Partly cloudy')
  const [temperature, setTemperature] = useState(DEMO_WEATHER.temperatureC)
  const [calculating, setCalculating] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [backendRecommendation, setBackendRecommendation] = useState<ReturnType<typeof irrigationService.recommend> | null>(null)

  useEffect(() => {
    if (farmPlots.length > 0 && !farmPlots.some((item) => item.name === plot)) {
      const first = farmPlots[0]
      setPlot(first.name)
      setCrop(first.crop)
      setStage(first.growthStage)
      setMoisture(first.soilMoisture ?? 35)
    }
    if (activeFarm?.soilType) {
      setSoilType(activeFarm.soilType)
    }
  }, [activeFarm?.id, activeFarm?.soilType, farmPlots, plot])

  const recommendation = useMemo(
    () => backendRecommendation ?? irrigationService.recommend({ plot, crop, stage, soilType, moisture, weather, temperature }),
    [backendRecommendation, plot, crop, stage, soilType, moisture, weather, temperature],
  )

  const columns: Column<BackendSoilReading>[] = [
    { key: 'date', label: 'Date', render: (row) => formatDate(row.createdAt) },
    {
      key: 'plot',
      label: 'Plot',
      render: (row) => {
        const matched = farmPlots.find((p) => p.id === row.plotId)
        return (
          <div>
            <p className="font-bold text-ink">{matched?.name ?? row.plotId}</p>
            <p className="text-[11px] text-muted">{row.recommendation.action}</p>
          </div>
        )
      },
    },
    { key: 'duration', label: 'Duration', render: (row) => `${row.recommendation.durationMin} min` },
    { key: 'water', label: 'Water', render: (row) => `${formatNumber(row.recommendation.waterLitres)} L` },
    { key: 'moisture', label: 'Moisture', render: (row) => `${row.soilMoisture}%` },
  ]

  const calculate = async () => {
    const matchedPlot = farmPlots.find((item) => item.name === plot) ?? farmPlots[0]
    if (!activeFarm || !matchedPlot) {
      setBackendRecommendation(null)
      show('Calculated locally', 'Add a farm plot in My Farm to save soil readings to your account.', 'info')
      return
    }
    setCalculating(true)
    try {
      const reading = await logSoilReading(activeFarm.id, {
        plotId: matchedPlot.id,
        soilMoisture: Math.min(100, Math.max(0, moisture)),
        source: 'simulated',
        weather: { condition: weather, temperatureC: temperature },
      })
      setBackendRecommendation(reading.recommendation)
      show('Recommendation updated', 'Soil reading saved to your farm record.', 'success')
    } catch (err) {
      setBackendRecommendation(null)
      show('Unable to save reading', err instanceof Error ? err.message : 'Backend error.', 'critical')
    } finally {
      setCalculating(false)
    }
  }

  const saveToSchedule = async () => {
    const daysAhead = recommendation.action === 'irrigate-now' ? 0 : recommendation.action === 'schedule' ? 1 : 3
    const nextDate = new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10)
    setSavingSchedule(true)
    try {
      await addIrrigationSchedule({
        plot,
        crop,
        stage,
        nextDate,
        reminder: true,
      })
      show('Schedule saved', `Irrigation schedule for ${plot} (${crop}) saved to database.`, 'success')
    } catch (err) {
      show('Unable to save schedule', err instanceof Error ? err.message : 'Backend error.', 'critical')
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleToggleReminder = async (id: string, currentlyOn: boolean, plotName: string) => {
    try {
      await toggleReminder(id)
      show(currentlyOn ? 'Reminder disabled' : 'Reminder enabled', plotName, 'info')
    } catch (err) {
      show('Unable to update reminder', err instanceof Error ? err.message : 'Backend error.', 'critical')
    }
  }

  const actionTone = recommendation.action === 'irrigate-now' ? 'critical' : recommendation.action === 'schedule' ? 'warning' : 'success'

  return (
    <div>
      <PageHeader
        eyebrow="Module 03 · Water planning"
        title="JalSense"
        description="Calculate irrigation recommendations from your farm plots, soil context, and moisture readings."
        badge={<DemoNote label="Advisory calculator" />}
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader title="Field inputs" description="Adjust values or select one of your saved plots." icon={<Gauge size={18} />} />
          <div className="space-y-4">
            <Field label="Plot">
              <Select
                value={plot}
                onChange={(event) => {
                  const next = farmPlots.find((item) => item.name === event.target.value)
                  setPlot(event.target.value)
                  setBackendRecommendation(null)
                  if (next) {
                    setCrop(next.crop)
                    setStage(next.growthStage)
                    setMoisture(next.soilMoisture ?? 35)
                  }
                }}
                options={
                  farmPlots.length > 0
                    ? farmPlots.map((item) => ({ value: item.name, label: item.name }))
                    : [{ value: 'Custom plot', label: 'No saved plot yet (trial mode)' }]
                }
              />
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
              {calculating ? 'Calculating…' : activeFarm && farmPlots.length > 0 ? 'Save reading & update recommendation' : 'Update recommendation'}
            </Button>
            {soilReadings.length > 0 ? (
              <p className="text-[11px] font-semibold text-forest">
                {soilReadings.length} soil reading{soilReadings.length === 1 ? '' : 's'} saved to your farm record.
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
                <h3 className="text-sm font-extrabold text-ink">How the model reached this result</h3>
                <ol className="mt-3 space-y-2.5">
                  {recommendation.reasoning.map((reason, index) => (
                    <li key={reason} className="flex gap-3 text-xs leading-relaxed text-muted">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-forest">{index + 1}</span>
                      {reason}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-1 items-start gap-2 rounded-2xl bg-[#FBF1DC] px-4 py-3 text-xs text-[#8A6520]">
                  <Info size={15} className="mt-0.5 shrink-0" />
                  {recommendation.confidenceNote}
                </div>
                <Button variant="outline" size="sm" onClick={() => void saveToSchedule()} disabled={savingSchedule}>
                  <CalendarPlus size={15} /> {savingSchedule ? 'Saving…' : 'Save to schedule'}
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Water usage" description="Simulated reference water curve (litres/day)." icon={<Droplets size={18} />} />
            <TrendChart data={DEMO_WATER_USAGE} xKey="day" yKey="litres" name="Litres" color="#344B35" height={210} />
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader title="Saved soil reading history" description="Soil readings saved to your farm plots." icon={<CalendarDays size={18} />} />
          {soilReadings.length > 0 ? (
            <DataTable columns={columns} rows={soilReadings} rowKey={(row) => row.id} compact />
          ) : (
            <p className="py-10 text-center text-sm text-muted">No soil readings saved yet. Add a plot in My Farm and save a reading above.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Upcoming schedule" description="Your saved irrigation reminders." icon={<CalendarDays size={18} />} />
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
                  onClick={() => void handleToggleReminder(item.id, item.reminder, item.plot)}
                  className={`mt-4 w-full rounded-xl px-3 py-2 text-xs font-bold transition-colors ${item.reminder ? 'bg-forest text-white' : 'bg-soft-sage text-forest'}`}
                >
                  {item.reminder ? 'Reminder on · tap to disable' : 'Reminder off · tap to enable'}
                </button>
              </div>
            ))}
            {irrigationSchedules.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No irrigation schedules saved yet.</p>
            ) : null}
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-soft-sage/45 p-3 text-[11px] text-muted">
            <Wind size={14} className="text-forest" /> Weather context: {DEMO_WEATHER.condition}, {DEMO_WEATHER.forecastRainMm} mm expected rain ({DEMO_WEATHER.source}).
          </div>
        </Card>
      </div>
    </div>
  )
}
