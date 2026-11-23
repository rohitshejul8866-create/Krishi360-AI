import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Clock3, FileSearch, TriangleAlert } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { StatCard } from '../../components/common/StatCard'
import { Card, CardHeader } from '../../components/ui/Card'
import { StatusPill } from '../../components/ui/Badge'
import { DataTable } from '../../components/ui/Table'
import type { Column } from '../../components/ui/Table'
import { BarChart } from '../../components/charts/BarChart'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../services/store'
import { DEMO_CASE_TREND } from '../../data/analytics'
import { relativeTime } from '../../services/utils'
import type { CropCase } from '../../types'

export function ExpertDashboard() {
  const { user } = useAuth()
  const { cases } = useApp()
  const assigned = cases.filter((item) => item.status !== 'resolved' || item.reviewStatus === 'completed')
  const pending = cases.filter((item) => item.reviewStatus === 'pending')
  const completed = cases.filter((item) => item.reviewStatus === 'completed')
  const highPriority = cases.filter((item) => item.priority === 'high' && item.reviewStatus !== 'completed')

  const columns: Column<CropCase>[] = [
    { key: 'id', label: 'Case', render: (row) => <div><p className="font-bold text-ink">{row.id}</p><p className="text-[11px] text-muted">{relativeTime(row.submittedAt)}</p></div> },
    { key: 'farmer', label: 'Farmer / crop', render: (row) => <div><p className="font-bold text-ink">{row.farmerName}</p><p className="text-[11px] text-muted">{row.crop} · {row.location}</p></div> },
    { key: 'condition', label: 'AI finding', render: (row) => row.condition },
    { key: 'confidence', label: 'Confidence', render: (row) => `${row.confidence}%` },
    { key: 'status', label: 'Review', render: (row) => <StatusPill status={row.reviewStatus} /> },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Expert workspace"
        title={`Review queue, ${user?.name.split(' ').slice(-1)[0] ?? 'Expert'}.`}
        description="Assigned crop cases, simulated AI findings and expert feedback workflows."
        badge={<DemoNote label="Demo authorisation" />}
        actions={<Link to="/expert/cases" className="inline-flex items-center gap-2 rounded-2xl bg-forest px-4 py-2.5 text-xs font-bold text-white hover:bg-[#2b402c]">View assigned cases <ArrowRight size={14} /></Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assigned cases" value={assigned.length} detail="In your demo workspace" icon={<FileSearch size={18} />} />
        <StatCard label="Pending reviews" value={pending.length} detail="Awaiting expert input" icon={<Clock3 size={18} />} tone="forest" />
        <StatCard label="Completed reviews" value={completed.length} detail="Guidance recorded" icon={<CheckCircle2 size={18} />} />
        <StatCard label="High priority" value={highPriority.length} detail="Requires early attention" icon={<TriangleAlert size={18} />} tone="alert" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader title="Assigned cases" description="Click a case from the full queue to review it." icon={<FileSearch size={18} />} />
          <DataTable columns={columns} rows={cases.slice(0, 6)} rowKey={(row) => row.id} compact />
          <Link to="/expert/cases" className="mt-4 inline-flex items-center gap-2 text-xs font-extrabold text-forest hover:underline">Open full queue <ArrowRight size={13} /></Link>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Case volume" description="Sample submitted versus reviewed cases." icon={<CheckCircle2 size={18} />} />
            <BarChart
              data={DEMO_CASE_TREND}
              xKey="week"
              bars={[
                { key: 'cases', name: 'Submitted', color: '#9CAF88' },
                { key: 'resolved', name: 'Reviewed', color: '#344B35' },
              ]}
              height={230}
            />
          </Card>
          <Card>
            <CardHeader title="High-priority queue" description="Cases flagged by the demo analysis." icon={<TriangleAlert size={18} />} />
            <div className="space-y-3">
              {highPriority.map((item) => (
                <Link key={item.id} to={`/expert/case-details?id=${item.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-[#FBE7E3]/60 px-4 py-3 transition-colors hover:bg-[#FBE7E3]">
                  <div>
                    <p className="text-xs font-extrabold text-ink">{item.id} · {item.crop}</p>
                    <p className="mt-1 text-[11px] text-muted">{item.farmerName} · {relativeTime(item.submittedAt)}</p>
                  </div>
                  <ArrowRight size={15} className="text-alert" />
                </Link>
              ))}
              {highPriority.length === 0 ? <p className="py-6 text-center text-xs text-muted">No high-priority cases.</p> : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
