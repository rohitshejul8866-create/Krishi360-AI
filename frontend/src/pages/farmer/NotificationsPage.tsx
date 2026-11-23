import { useMemo, useState } from 'react'
import { AlertTriangle, Bell, CheckCircle2, Info, XCircle } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Tabs } from '../../components/ui/Tabs'
import { Card } from '../../components/ui/Card'
import { useApp } from '../../services/store'
import { useToast } from '../../context/ToastContext'
import { formatDateTime, relativeTime } from '../../services/utils'
import type { NotificationItem, Severity } from '../../types'

const icons: Record<Severity, typeof Bell> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
}

const tones: Record<Severity, 'info' | 'success' | 'warning' | 'critical'> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  critical: 'critical',
}

export function NotificationsPage() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useApp()
  const { show } = useToast()
  const [tab, setTab] = useState('all')

  const items = useMemo(() => {
    const visible = notifications.filter((item) => item.audience === 'farmer' || item.audience === 'all')
    if (tab === 'unread') return visible.filter((item) => !item.read)
    if (tab === 'critical') return visible.filter((item) => item.severity === 'critical' || item.severity === 'warning')
    return visible
  }, [notifications, tab])

  const unread = notifications.filter((item) => (item.audience === 'farmer' || item.audience === 'all') && !item.read).length

  const markAll = () => {
    markAllNotificationsRead('farmer')
    show('Notifications updated', 'All visible farmer notifications are marked as read.', 'success')
  }

  const markOne = (item: NotificationItem) => {
    markNotificationRead(item.id)
    show('Marked as read', item.title, 'info')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Support"
        title="Notifications"
        description="Alerts and updates from your simulated farm workspace."
        actions={<Button variant="outline" onClick={markAll} disabled={unread === 0}><CheckCircle2 size={15} /> Mark all read</Button>}
      />

      <Tabs
        items={[
          { id: 'all', label: `All (${notifications.filter((item) => item.audience === 'farmer' || item.audience === 'all').length})` },
          { id: 'unread', label: `Unread (${unread})` },
          { id: 'critical', label: 'Warnings & alerts' },
        ]}
        activeId={tab}
        onChange={setTab}
        className="mb-5 max-w-lg"
      />

      <div className="space-y-3">
        {items.map((item) => {
          const Icon = icons[item.severity]
          return (
            <Card key={item.id} className={item.read ? 'opacity-75' : 'border-sage/50'}>
              <div className="flex items-start gap-4">
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${
                  item.severity === 'critical' ? 'bg-[#FBE7E3] text-alert' : item.severity === 'warning' ? 'bg-[#FBF1DC] text-[#8A6520]' : 'bg-soft-sage text-forest'
                }`}>
                  <Icon size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-extrabold text-ink">{item.title}</h2>
                    <Badge tone={tones[item.severity]}>{item.severity}</Badge>
                    {!item.read ? <span className="size-2 rounded-full bg-sage" /> : null}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                  <p className="mt-2 text-[11px] text-muted">{relativeTime(item.createdAt)} · {formatDateTime(item.createdAt)}</p>
                </div>
                {!item.read ? (
                  <Button variant="ghost" size="sm" onClick={() => markOne(item)}>Mark read</Button>
                ) : null}
              </div>
            </Card>
          )
        })}
        {items.length === 0 ? (
          <Card className="py-14 text-center">
            <Bell size={28} className="mx-auto text-forest" />
            <p className="mt-3 text-sm font-bold text-ink">Nothing in this view.</p>
            <p className="mt-1 text-xs text-muted">Adjust the tab to see other notifications.</p>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
