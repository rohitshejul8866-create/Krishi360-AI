import { useMemo, useState } from 'react'
import { Activity, Download, FileBarChart, TrendingUp, Users } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { StatCard } from '../../components/common/StatCard'
import { ChartCard } from '../../components/charts/ChartCard'
import { BarChart } from '../../components/charts/BarChart'
import { DonutChart } from '../../components/charts/DonutChart'
import { Button } from '../../components/ui/Button'
import { Field, Select } from '../../components/ui/Input'
import { CHART_COLORS, DEMO_CASE_TREND, DEMO_MODULE_USAGE, DEMO_REGION_SPLIT, DEMO_REVIEW_FUNNEL, DEMO_USER_GROWTH } from '../../data/analytics'
import { useToast } from '../../context/ToastContext'
import { useApp } from '../../services/store'

type Metric = 'cases' | 'users' | 'modules'

export function ReportsAnalyticsPage() {
  const { cases, users, schemes, notifications, storageBatches } = useApp()
  const { show } = useToast()
  const [metric, setMetric] = useState<Metric>('cases')
  const [period, setPeriod] = useState('30')

  const multiplier = period === '7' ? 0.25 : period === '90' ? 2.5 : 1
  const scale = (value: number) => Math.max(1, Math.round(value * multiplier))

  const chart = useMemo(() => {
    if (metric === 'users') {
      return {
        xKey: 'month',
        bars: [
          { key: 'farmers', name: 'Farmers', color: CHART_COLORS.sage },
          { key: 'experts', name: 'Experts', color: CHART_COLORS.forest },
        ],
        data: DEMO_USER_GROWTH.map((row) => ({ ...row, farmers: scale(row.farmers), experts: scale(row.experts) })),
      }
    }
    if (metric === 'modules') {
      return {
        xKey: 'module',
        bars: [{ key: 'usage', name: 'Interactions', color: CHART_COLORS.sage }],
        data: DEMO_MODULE_USAGE.map((row) => ({ ...row, usage: scale(row.usage) })),
      }
    }
    return {
      xKey: 'week',
      bars: [
        { key: 'cases', name: 'Submitted', color: CHART_COLORS.sage },
        { key: 'resolved', name: 'Resolved', color: CHART_COLORS.forest },
      ],
      data: DEMO_CASE_TREND.map((row) => ({ ...row, cases: scale(row.cases), resolved: scale(row.resolved) })),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, period])

  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      periodDays: Number(period),
      simulated: true,
      summary: {
        totalUsers: users.length,
        totalCases: cases.length,
        schemes: schemes.length,
        notifications: notifications.length,
        storageBatches: storageBatches.length,
      },
      charts: chart.data,
      note: 'Generated from local demo data. Not a production analytics export.',
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `krishi360-demo-report-${period}d.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    show('Report exported', `Demo analytics for ${period} days downloaded as JSON.`)
  }

  const metrics: { key: Metric; label: string }[] = [
    { key: 'cases', label: 'Cases' },
    { key: 'users', label: 'Users' },
    { key: 'modules', label: 'Modules' },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Reports & analytics"
        description="Explore sample platform trends and export a frontend-only demo report. Figures are illustrative and do not represent real usage."
        badge={<DemoNote label="Simulated analytics" />}
        actions={<Button size="sm" variant="outline" onClick={exportReport}><Download size={14} /> Export report</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cases in dataset" value={cases.length} detail="Local case records" icon={<Activity size={18} />} tone="sage" />
        <StatCard label="Accounts in dataset" value={users.length} detail="Across all roles" icon={<Users size={18} />} tone="forest" />
        <StatCard label="Resolved reviews" value={cases.filter((item) => item.reviewStatus === 'completed').length} detail="Expert guidance complete" icon={<FileBarChart size={18} />} tone="neutral" />
        <StatCard label="Growth trend" value="+18%" detail="Illustrative sample only" icon={<TrendingUp size={18} />} tone="alert" />
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 rounded-[26px] border border-white/70 bg-white/55 p-4 shadow-[0_16px_40px_-30px_rgba(29,42,30,0.5)] backdrop-blur-xl">
        <div className="flex flex-wrap gap-2">
          {metrics.map((item) => (
            <Button key={item.key} size="sm" variant={metric === item.key ? 'primary' : 'outline'} onClick={() => setMetric(item.key)}>{item.label}</Button>
          ))}
        </div>
        <Field label="Reporting window" className="w-44">
          <Select value={period} onChange={(event) => setPeriod(event.target.value)} options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]} />
        </Field>
      </div>

      <ChartCard title={`${metrics.find((item) => item.key === metric)?.label} trend`} subtitle={`Scaled demo dataset · ${period}-day window`} action={<DemoNote label="Not live" />}>
        <BarChart data={chart.data} xKey={chart.xKey} bars={chart.bars} height={300} />
      </ChartCard>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ChartCard title="Farmer region split" subtitle="Illustrative geographic distribution">
          <DonutChart data={DEMO_REGION_SPLIT.map((item) => ({ name: item.name, value: scale(item.value), color: item.name === 'Maharashtra' ? CHART_COLORS.forest : CHART_COLORS.sage }))} centerValue={`${DEMO_REGION_SPLIT.length}`} centerLabel="regions" />
        </ChartCard>
        <ChartCard title="Expert review funnel" subtitle="Sample case progression through demo review stages">
          <BarChart
            data={DEMO_REVIEW_FUNNEL.map((row) => ({ ...row, count: scale(row.count) }))}
            xKey="stage"
            bars={[{ key: 'count', name: 'Cases', color: CHART_COLORS.forest }]}
            height={240}
          />
        </ChartCard>
      </div>

      <div className="mt-6 rounded-[26px] border border-sage/30 bg-soft-sage/45 p-5 text-sm leading-relaxed text-forest">
        <p className="font-bold">Data note</p>
        <p className="mt-1 text-xs">All charts use static sample data bundled with the frontend. Changing the window only rescales the demo series; it does not query a database or analytics service.</p>
      </div>
    </div>
  )
}
