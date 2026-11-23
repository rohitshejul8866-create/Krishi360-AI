import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  Bell,
  CheckCircle2,
  FlaskConical,
  Landmark,
  MessageSquareText,
  ScrollText,
  Server,
  ShieldCheck,
  Store,
  TriangleAlert,
  Users,
  Warehouse,
} from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { StatCard } from '../../components/common/StatCard'
import { Card, CardHeader } from '../../components/ui/Card'
import { StatusPill } from '../../components/ui/Badge'
import { BarChart } from '../../components/charts/BarChart'
import { DonutChart } from '../../components/charts/DonutChart'
import { Reveal } from '../../components/animations/Reveal'
import { Stagger, StaggerItem } from '../../components/animations/Stagger'
import { DEMO_CASE_TREND, DEMO_MODULE_USAGE, DEMO_REGION_SPLIT } from '../../data/analytics'
import { CHART_COLORS } from '../../data/analytics'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../services/store'
import { relativeTime } from '../../services/utils'

export function AdminDashboard() {
  const { user } = useAuth()
  const { cases, users, schemes, storageBatches, mandiAlerts, auditLogs, notifications } = useApp()
  const openCases = cases.filter((item) => item.status !== 'resolved')
  const criticalBatches = storageBatches.filter((batch) => batch.status === 'critical')
  const pendingUsers = users.filter((account) => account.status === 'invited')

  const quickLinks = [
    { label: 'Backend & AWS DB', to: '/admin/backend', icon: Server, detail: 'DynamoDB & APIs' },
    { label: 'User management', to: '/admin/users', icon: Users, detail: `${pendingUsers.length} invited` },
    { label: 'Crop cases', to: '/admin/cases', icon: Activity, detail: `${openCases.length} open` },
    { label: 'Mandi data', to: '/admin/mandi', icon: Store, detail: `${mandiAlerts.length} alerts` },
    { label: 'Schemes', to: '/admin/schemes', icon: Landmark, detail: `${schemes.length} entries` },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Platform control room"
        title={`Operations overview, ${user?.name.split(' ')[0] ?? 'Admin'}.`}
        description="A single view of activity across the three portals, five modules, and connected backend database."
        badge={<DemoNote label="Connected backend" />}
        actions={
          <>
            <Link to="/admin/backend" className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white/70 px-4 py-2.5 text-xs font-bold text-forest hover:border-sage"><Server size={15} /> Backend & AWS DB</Link>
            <Link to="/admin/audit-logs" className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white/70 px-4 py-2.5 text-xs font-bold text-forest hover:border-sage"><ScrollText size={15} /> Audit logs</Link>
            <Link to="/admin/settings" className="inline-flex items-center gap-2 rounded-2xl bg-forest px-4 py-2.5 text-xs font-bold text-white hover:bg-[#2b402c]"><ShieldCheck size={15} /> Platform settings</Link>
          </>
        }
      />

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total users', value: users.length, detail: 'Registered portal accounts', icon: Users, tone: 'sage' as const },
          { label: 'Open cases', value: openCases.length, detail: 'Farmer diagnoses in progress', icon: Activity, tone: 'forest' as const },
          { label: 'Storage alerts', value: criticalBatches.length, detail: 'Simulated critical batches', icon: Warehouse, tone: criticalBatches.length ? ('alert' as const) : ('sage' as const) },
          { label: 'Notifications', value: notifications.length, detail: 'Local announcements', icon: Bell, tone: 'neutral' as const },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <StaggerItem key={stat.label}>
              <StatCard label={stat.label} value={stat.value} detail={stat.detail} icon={<Icon size={18} />} tone={stat.tone} />
            </StaggerItem>
          )
        })}
      </Stagger>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Reveal>
          <Card>
            <CardHeader
              title="Case volume"
              description="Sample submitted versus resolved cases over six demo weeks."
              icon={<Activity size={18} />}
              action={<Link to="/admin/analytics" className="text-xs font-extrabold text-forest hover:underline">Full analytics <ArrowRight size={13} className="inline" /></Link>}
            />
            <BarChart
              data={DEMO_CASE_TREND}
              xKey="week"
              bars={[
                { key: 'cases', name: 'Submitted', color: CHART_COLORS.sage },
                { key: 'resolved', name: 'Resolved', color: CHART_COLORS.forest },
              ]}
            />
          </Card>
        </Reveal>

        <Reveal delay={0.08}>
          <Card>
            <CardHeader title="Farmer regions" description="Illustrative distribution from the demo dataset." icon={<Users size={18} />} />
            <DonutChart
              data={DEMO_REGION_SPLIT.map((item) => ({ ...item, color: item.name === 'Maharashtra' ? CHART_COLORS.forest : CHART_COLORS.sage }))}
              centerValue="5"
              centerLabel="regions"
            />
          </Card>
        </Reveal>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Reveal className="xl:col-span-2">
          <Card>
            <CardHeader title="Module usage" description="Demo engagement counts for the five agriculture modules." icon={<FlaskConical size={18} />} />
            <BarChart data={DEMO_MODULE_USAGE} xKey="module" bars={[{ key: 'usage', name: 'Interactions', color: CHART_COLORS.sage }]} height={230} />
          </Card>
        </Reveal>

        <Reveal delay={0.08}>
          <Card>
            <CardHeader title="Quick actions" description="Jump into a management workspace." icon={<ShieldCheck size={18} />} />
            <div className="grid gap-3">
              {quickLinks.map((link) => {
                const Icon = link.icon
                return (
                  <Link key={link.to} to={link.to} className="flex items-center justify-between gap-3 rounded-2xl border border-line/80 bg-white/60 px-4 py-3 transition-colors hover:border-sage hover:bg-white">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-2xl bg-soft-sage text-forest"><Icon size={16} /></span>
                      <div>
                        <p className="text-sm font-extrabold text-ink">{link.label}</p>
                        <p className="text-[11px] text-muted">{link.detail}</p>
                      </div>
                    </div>
                    <ArrowRight size={15} className="text-muted" />
                  </Link>
                )
              })}
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Reveal>
          <Card>
            <CardHeader title="Needs attention" description="Items flagged by simulated rules." icon={<TriangleAlert size={18} />} />
            <div className="space-y-3">
              {storageBatches.filter((batch) => batch.status !== 'normal').slice(0, 3).map((batch) => (
                <div key={batch.id} className="rounded-2xl bg-[#FBF1DC]/70 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-extrabold text-ink">{batch.code} · {batch.crop}</p>
                    <StatusPill status={batch.status} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted">{batch.tempC}°C / {batch.humidity}% RH · {batch.location}</p>
                </div>
              ))}
              {storageBatches.every((batch) => batch.status === 'normal') ? <p className="text-xs text-muted">No storage warnings.</p> : null}
            </div>
            <Link to="/admin/storage" className="mt-4 inline-flex items-center gap-1 text-xs font-extrabold text-forest hover:underline">Open storage monitoring <ArrowRight size={13} /></Link>
          </Card>
        </Reveal>

        <Reveal delay={0.08}>
          <Card>
            <CardHeader title="Recent activity" description="Latest local audit events." icon={<ScrollText size={18} />} />
            <div className="space-y-3">
              {auditLogs.slice(0, 4).map((log) => (
                <div key={log.id} className="rounded-2xl bg-soft-sage/40 px-4 py-3">
                  <p className="text-xs font-extrabold text-ink">{log.action}</p>
                  <p className="mt-1 text-[11px] text-muted">{log.actor} · {relativeTime(log.timestamp)}</p>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.16}>
          <Card>
            <CardHeader title="Review queue" description="Cases waiting for expert attention." icon={<MessageSquareText size={18} />} />
            <div className="space-y-3">
              {cases.filter((item) => item.reviewStatus === 'pending').slice(0, 4).map((item) => (
                <Link key={item.id} to="/admin/cases" className="flex items-center justify-between gap-3 rounded-2xl border border-line/70 px-4 py-3 hover:border-sage">
                  <div>
                    <p className="text-xs font-extrabold text-ink">{item.id} · {item.crop}</p>
                    <p className="mt-1 text-[11px] text-muted">{item.farmerName} · {relativeTime(item.submittedAt)}</p>
                  </div>
                  <ArrowRight size={14} className="text-muted" />
                </Link>
              ))}
              {cases.every((item) => item.reviewStatus !== 'pending') ? <p className="text-xs text-muted">No pending reviews.</p> : null}
            </div>
            <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-forest"><CheckCircle2 size={14} /> Expert SLA is simulated only</div>
          </Card>
        </Reveal>
      </div>
    </div>
  )
}
