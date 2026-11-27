import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  HardDrive,
  Layers,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Sprout,
  Table2,
  Terminal,
  Wrench,
} from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { StatCard } from '../../components/common/StatCard'
import { Badge, StatusPill } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { DataTable, type Column } from '../../components/ui/Table'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import {
  backendService,
  type BackendEndpointInfo,
  type BackendEntityName,
  type BackendStatusSnapshot,
} from '../../services/backendService'
import { useApp } from '../../services/store'
import { formatDateTime } from '../../services/utils'

const PAGE_TABS: TabItem[] = [
  { id: 'overview', label: 'Database & Schema', icon: <Database size={15} /> },
  { id: 'records', label: 'Database Records', icon: <Table2 size={15} /> },
  { id: 'endpoints', label: 'Backend APIs', icon: <Terminal size={15} /> },
]

const ENTITY_OPTIONS: { id: BackendEntityName; label: string }[] = [
  { id: 'cropCases', label: 'Crop cases' },
  { id: 'mandiPrices', label: 'Mandi prices' },
  { id: 'schemes', label: 'Schemes' },
  { id: 'storageBatches', label: 'Storage batches' },
  { id: 'farms', label: 'Farms' },
  { id: 'users', label: 'User accounts' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'auditLogs', label: 'Audit logs' },
]

function summarizeRecord(entity: BackendEntityName, row: Record<string, unknown>) {
  const id = String(row.id ?? '—')
  switch (entity) {
    case 'cropCases':
      return {
        primary: `${row.crop ?? 'Crop'} · ${row.plantPart ?? ''}`,
        secondary: String(row.farmerName ?? row.farmerId ?? ''),
        meta: String(row.status ?? 'new'),
        updated: String(row.updatedAt ?? row.createdAt ?? ''),
      }
    case 'mandiPrices':
      return {
        primary: `${row.crop ?? 'Crop'} · ₹${row.modalPrice ?? 0}/q`,
        secondary: `${row.mandi ?? ''}, ${row.state ?? ''}`,
        meta: String(row.dataType ?? 'sample'),
        updated: String(row.date ?? row.lastUpdatedAt ?? ''),
      }
    case 'schemes':
      return {
        primary: String(row.name ?? 'Scheme'),
        secondary: `${row.category ?? ''} · ${row.state ?? ''}`,
        meta: String(row.dataType ?? 'sample'),
        updated: String(row.lastUpdatedAt ?? row.createdAt ?? ''),
      }
    case 'storageBatches':
      return {
        primary: `${row.code ?? id} · ${row.crop ?? ''}`,
        secondary: String(row.location ?? ''),
        meta: String(row.status ?? 'normal'),
        updated: String(row.updatedAt ?? row.createdAt ?? ''),
      }
    case 'farms':
      return {
        primary: String(row.name ?? 'Farm'),
        secondary: `${row.location ?? ''} · ${row.areaHa ?? 0} ha`,
        meta: `${Array.isArray(row.plots) ? row.plots.length : 0} plots`,
        updated: String(row.updatedAt ?? row.createdAt ?? ''),
      }
    case 'users':
      return {
        primary: String(row.name ?? 'User'),
        secondary: `${row.email ?? ''} · ${row.role ?? ''}`,
        meta: String(row.status ?? 'active'),
        updated: String(row.updatedAt ?? row.joinedAt ?? ''),
      }
    case 'notifications':
      return {
        primary: String(row.title ?? 'Notification'),
        secondary: `Audience: ${row.audience ?? 'all'}`,
        meta: String(row.severity ?? 'info'),
        updated: String(row.createdAt ?? ''),
      }
    case 'auditLogs':
      return {
        primary: String(row.action ?? 'Action'),
        secondary: `${row.actorId ?? ''} (${row.actorRole ?? ''})`,
        meta: String(row.target ?? '—'),
        updated: String(row.timestamp ?? ''),
      }
  }
}

export function BackendDatabasePage() {
  const { user } = useAuth()
  const { syncBackendData, backendConnected } = useApp()
  const { show } = useToast()

  const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'endpoints'>('overview')
  const [status, setStatus] = useState<BackendStatusSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<'refresh' | 'table' | 'seed' | 'sync' | 'health' | 'export' | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [selectedEntity, setSelectedEntity] = useState<BackendEntityName>('cropCases')
  const [records, setRecords] = useState<Record<string, unknown>[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [inspectedRecord, setInspectedRecord] = useState<Record<string, unknown> | null>(null)

  const [testedPath, setTestedPath] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{
    path: string
    durationMs: number
    payload: unknown
  } | null>(null)
  const [testingPath, setTestingPath] = useState<string | null>(null)

  const loadStatus = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    setErrorMsg(null)
    try {
      const next = await backendService.getStatus()
      setStatus(next)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach backend status endpoint.'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRecords = useCallback(async (entity: BackendEntityName) => {
    setRecordsLoading(true)
    try {
      const res = await backendService.listRecords(entity, 25)
      setRecords(res.items)
    } catch (err) {
      setRecords([])
      show(
        'Could not load records',
        err instanceof Error ? err.message : 'Failed to query repository records.',
        'warning',
      )
    } finally {
      setRecordsLoading(false)
    }
  }, [show])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (activeTab === 'records') {
      void loadRecords(selectedEntity)
    }
  }, [activeTab, selectedEntity, loadRecords])

  const totalRecords = useMemo(() => {
    if (!status) return 0
    return Object.values(status.counts).reduce((sum, n) => sum + n, 0)
  }, [status])

  const handleRefresh = async () => {
    setBusyAction('refresh')
    await loadStatus(true)
    if (activeTab === 'records') await loadRecords(selectedEntity)
    setBusyAction(null)
    show('Database status refreshed', 'Live collection counts and storage diagnostics updated.')
  }

  const handleHealthCheck = async () => {
    setBusyAction('health')
    try {
      const next = await backendService.healthCheck()
      setStatus(next)
      if (next.sqlite) {
        show(
          next.sqlite.integrityOk ? 'SQLite integrity OK' : 'SQLite check warning',
          next.sqlite.message,
          next.sqlite.integrityOk ? 'success' : 'warning',
        )
      } else {
        show('Database health checked', next.dynamo.message, 'success')
      }
    } catch (err) {
      show(
        'Integrity check failed',
        err instanceof Error ? err.message : 'Unable to complete database health check.',
        'warning',
      )
    } finally {
      setBusyAction(null)
    }
  }

  const handleExportSnapshot = async () => {
    setBusyAction('export')
    try {
      const snapshot = await backendService.exportSnapshot()
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `krishi360-db-snapshot-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      show('Database exported', 'Sanitized JSON snapshot downloaded (sensitive credentials excluded).', 'success')
    } catch (err) {
      show(
        'Export failed',
        err instanceof Error ? err.message : 'Could not export database snapshot.',
        'critical',
      )
    } finally {
      setBusyAction(null)
    }
  }

  const handleEnsureTable = async () => {
    setBusyAction('table')
    try {
      const next = await backendService.ensureTable()
      setStatus(next)
      show('DynamoDB table verified', next.dynamo.message, 'success')
    } catch (err) {
      show(
        'AWS DynamoDB check',
        err instanceof Error ? err.message : 'Verify AWS credentials in server Secrets.',
        'warning',
      )
    } finally {
      setBusyAction(null)
    }
  }

  const handleSeed = async () => {
    setBusyAction('seed')
    try {
      const next = await backendService.seedDatabase('missing')
      setStatus(next)
      await syncBackendData(user ? { id: user.id, role: user.role, name: user.name } : null)
      if (activeTab === 'records') await loadRecords(selectedEntity)
      const detail = next.seedResult
        ? `${next.seedResult.inserted} added, ${next.seedResult.skipped} preserved in ${next.dataBackend.toUpperCase()}.`
        : `Records verified in ${next.dataBackend.toUpperCase()} database.`
      show('Database seeded', detail, 'success')
    } catch (err) {
      show(
        'Seed failed',
        err instanceof Error ? err.message : 'Could not seed active database.',
        'critical',
      )
    } finally {
      setBusyAction(null)
    }
  }

  const handleSyncPortal = async () => {
    setBusyAction('sync')
    await syncBackendData(user ? { id: user.id, role: user.role, name: user.name } : null)
    await loadStatus(true)
    setBusyAction(null)
    show('Modules synced', 'All portal modules synchronized with backend database.')
  }

  const handleTestEndpoint = async (endpoint: BackendEndpointInfo) => {
    if (endpoint.method !== 'GET') return
    setTestingPath(endpoint.path)
    setTestedPath(endpoint.path)
    try {
      const res = await backendService.testGetEndpoint(endpoint.path)
      setTestResult({ path: endpoint.path, ...res })
      show('Endpoint responded', `${endpoint.path} returned 200 OK in ${res.durationMs}ms.`, 'success')
    } catch (err) {
      setTestResult({
        path: endpoint.path,
        durationMs: 0,
        payload: { error: err instanceof Error ? err.message : 'Request failed' },
      })
      show('Endpoint error', err instanceof Error ? err.message : 'Request failed.', 'warning')
    } finally {
      setTestingPath(null)
    }
  }

  const recordColumns: Column<Record<string, unknown>>[] = [
    {
      key: 'id',
      label: 'Record ID',
      render: (row) => <span className="font-mono text-xs font-bold text-forest">{String(row.id ?? '—')}</span>,
    },
    {
      key: 'summary',
      label: 'Entity summary',
      render: (row) => {
        const info = summarizeRecord(selectedEntity, row)
        return (
          <div>
            <p className="font-bold text-ink">{info.primary}</p>
            <p className="text-xs text-muted">{info.secondary}</p>
          </div>
        )
      },
    },
    {
      key: 'meta',
      label: 'State / Meta',
      render: (row) => <StatusPill status={summarizeRecord(selectedEntity, row).meta} />,
    },
    {
      key: 'updated',
      label: 'Timestamp',
      render: (row) => {
        const raw = summarizeRecord(selectedEntity, row).updated
        return <span className="text-xs text-muted">{raw.includes('T') ? formatDateTime(raw) : raw || '—'}</span>
      },
    },
  ]

  const endpointColumns: Column<BackendEndpointInfo>[] = [
    {
      key: 'method',
      label: 'Method',
      render: (ep) => (
        <Badge tone={ep.method === 'GET' ? 'sage' : 'forest'}>{ep.method}</Badge>
      ),
    },
    {
      key: 'path',
      label: 'Route',
      render: (ep) => (
        <div>
          <p className="font-mono text-xs font-bold text-ink">{ep.path}</p>
          <p className="text-xs text-muted">{ep.description}</p>
        </div>
      ),
    },
    {
      key: 'module',
      label: 'Module',
      render: (ep) => <span className="text-xs font-semibold text-ink">{ep.module}</span>,
    },
    {
      key: 'auth',
      label: 'Access',
      render: (ep) => <Badge tone="neutral">{ep.auth}</Badge>,
    },
    {
      key: 'action',
      label: 'Test',
      render: (ep) =>
        ep.method === 'GET' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={testingPath === ep.path}
            onClick={() => void handleTestEndpoint(ep)}
          >
            <Play size={13} />
            {testingPath === ep.path ? 'Running…' : 'Run GET'}
          </Button>
        ) : (
          <span className="text-xs text-muted">Mutation</span>
        ),
    },
  ]

  const engineLabel =
    status?.dataBackend === 'dynamodb'
      ? 'AWS DynamoDB'
      : status?.dataBackend === 'sqlite'
        ? 'SQLite Single-Table (WAL)'
        : 'In-Memory'

  return (
    <div>
    <PageHeader
        eyebrow="Infrastructure & Persistence"
        title="Backend & 2-Table Database"
        description="Inspect 2-table persistence: Table 1 stores only user login details, while Table 2 (Flag Table) stores user profiles, platform flags, and all domain collections."
        badge={
          <Badge tone={status?.dataBackend === 'memory' ? 'sage' : 'forest'}>
            {status ? `${status.dataBackend.toUpperCase()} · ${status.awsRegion}` : 'Connecting…'}
          </Badge>
        }
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={busyAction !== null}
              onClick={() => void handleRefresh()}
            >
              <RefreshCw size={14} className={busyAction === 'refresh' ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busyAction !== null}
              onClick={() => void handleHealthCheck()}
            >
              <Activity size={14} />
              {busyAction === 'health' ? 'Checking…' : 'Integrity Check'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busyAction !== null}
              onClick={() => void handleExportSnapshot()}
            >
              <Download size={14} />
              {busyAction === 'export' ? 'Exporting…' : 'Export JSON'}
            </Button>
            {status?.awsCredentialsConfigured ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busyAction !== null}
                onClick={() => void handleEnsureTable()}
              >
                <Wrench size={14} />
                Verify AWS Table
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={busyAction !== null}
              onClick={() => void handleSeed()}
            >
              <Sprout size={14} />
              {busyAction === 'seed' ? 'Seeding…' : 'Seed Missing'}
            </Button>
          </>
        }
      />

      {errorMsg ? (
        <Card className="mb-6 border-[#F3C4BC] bg-[#FBE7E3]/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-alert">{errorMsg}</p>
            <Button size="sm" variant="outline" onClick={() => void handleRefresh()}>
              Retry
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Engine"
          value={status ? engineLabel : '—'}
          detail={backendConnected ? 'Frontend synced with backend DB' : 'Connecting portal store'}
          icon={<Server size={18} />}
          tone={status?.dataBackend === 'memory' ? 'sage' : 'forest'}
        />
        <StatCard
          label={status?.sqlite ? 'SQLite Storage' : 'DynamoDB Tables (2)'}
          value={
            status?.sqlite
              ? `${(status.sqlite.fileSizeBytes / 1024).toFixed(1)} KB`
              : `${status?.usersTableName ?? 'krishi360-users-dev'} + ${status?.flagTableName ?? 'krishi360-flag-dev'}`
          }
          detail={
            status?.sqlite
              ? `${status.sqlite.usersItems} login + ${status.sqlite.flagItems} flag items`
              : status
                ? `${status.dynamo.tableStatus} · ${status.awsRegion}`
                : 'Checking storage'
          }
          icon={status?.sqlite ? <HardDrive size={18} /> : <Database size={18} />}
          tone={status?.sqlite?.integrityOk || status?.dynamo.tableStatus === 'ACTIVE' ? 'forest' : 'neutral'}
        />
        <StatCard
          label="Stored Records"
          value={loading ? '…' : totalRecords}
          detail="Across 8 database collections"
          icon={<Layers size={18} />}
          tone="sage"
        />
        <StatCard
          label="AI & S3 Media"
          value={status ? status.aiProvider.toUpperCase() : '—'}
          detail={
            status?.s3?.reachable
              ? `S3 active (${status.s3.bucketName})`
              : status?.s3UploadsConfigured
                ? `S3 ${status.s3?.status ?? 'configured'}`
                : 'Local / simulated media mode'
          }
          icon={<Cloud size={18} />}
          tone={status?.awsCredentialsConfigured || status?.s3?.reachable ? 'forest' : 'neutral'}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <Tabs
          items={PAGE_TABS}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as 'overview' | 'records' | 'endpoints')}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busyAction !== null}
          onClick={() => void handleSyncPortal()}
        >
          <RefreshCw size={14} className={busyAction === 'sync' ? 'animate-spin' : ''} />
          Sync all portal modules
        </Button>
      </div>

      {activeTab === 'overview' ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader
              title="2-table DynamoDB & SQLite architecture"
              description="Table 1 stores only user login details (credentials, email & role lookups); Table 2 (Flag Table) stores user profiles, flags, and all module collections."
              icon={<Database size={18} />}
              action={
                status?.sqlite ? (
                  <Badge tone={status.sqlite.integrityOk ? 'forest' : 'critical'}>
                    {status.sqlite.integrityOk ? 'SQLite WAL Active' : 'Integrity Warning'}
                  </Badge>
                ) : status ? (
                  <StatusPill status={status.dynamo.tableStatus} />
                ) : null
              }
            />
            {status?.sqlite ? (
              <div className="mb-4 rounded-2xl border border-sage/50 bg-soft-sage/45 px-4 py-3 text-xs leading-relaxed text-ink">
                <p className="font-bold text-forest">SQLite 2-table persistence engine (krishi_users + krishi_flag_items)</p>
                <p className="mt-1 text-muted">{status.sqlite.message}</p>
                <p className="mt-1 font-mono text-[11px] text-forest">Path: {status.sqlite.dbPath}</p>
              </div>
            ) : null}
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line/80 bg-soft-sage/30 px-4 py-3 text-xs leading-relaxed text-ink">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-forest">Table 1 · Users Login</p>
                  {status ? <StatusPill status={status.usersDynamo.tableStatus} /> : null}
                </div>
                <p className="mt-1 font-mono text-[11px] text-ink">{status?.usersTableName ?? 'krishi360-users-dev'}</p>
                <p className="mt-1 text-muted">
                  {status?.usersDynamo.message ?? 'Loading user login table status...'}
                </p>
              </div>
              <div className="rounded-2xl border border-line/80 bg-soft-sage/30 px-4 py-3 text-xs leading-relaxed text-ink">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-forest">Table 2 · Flag & Domain Data</p>
                  {status ? <StatusPill status={status.flagDynamo.tableStatus} /> : null}
                </div>
                <p className="mt-1 font-mono text-[11px] text-ink">{status?.flagTableName ?? 'krishi360-flag-dev'}</p>
                <p className="mt-1 text-muted">
                  {status?.flagDynamo.message ?? 'Loading flag table status...'}
                </p>
              </div>
            </div>
            <div className="scroll-thin overflow-x-auto rounded-2xl border border-line/80">
              <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-soft-sage/45 text-[11px] font-extrabold tracking-[0.08em] text-muted uppercase">
                    <th className="px-3.5 py-3">Table</th>
                    <th className="px-3.5 py-3">Entity</th>
                    <th className="px-3.5 py-3">PK</th>
                    <th className="px-3.5 py-3">SK</th>
                    <th className="px-3.5 py-3">GSI1</th>
                    <th className="px-3.5 py-3">GSI2</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70 bg-white/70">
                  {(status?.singleTableSchema ?? []).map((row) => (
                    <tr key={`${row.table}-${row.entity}`} className="hover:bg-soft-sage/20">
                      <td className="px-3.5 py-2.5">
                        <Badge tone={row.table === 'Users Login Table' ? 'forest' : 'sage'}>{row.table}</Badge>
                      </td>
                      <td className="px-3.5 py-2.5 font-bold text-ink">{row.entity}</td>
                      <td className="px-3.5 py-2.5 font-mono text-forest">{row.pkPattern}</td>
                      <td className="px-3.5 py-2.5 font-mono text-muted">{row.skPattern}</td>
                      <td className="px-3.5 py-2.5 font-mono text-muted">{row.gsi1}</td>
                      <td className="px-3.5 py-2.5 font-mono text-muted">{row.gsi2}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Live collection counts"
                description="Current persisted item counts served by the active repository layer."
                icon={<Layers size={18} />}
              />
              <div className="grid grid-cols-2 gap-3">
                {ENTITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedEntity(opt.id)
                      setActiveTab('records')
                    }}
                    className="flex items-center justify-between rounded-2xl border border-line/80 bg-white/70 px-4 py-3 text-left transition-colors hover:border-sage hover:bg-white"
                  >
                    <span className="text-xs font-bold text-ink">{opt.label}</span>
                    <span className="font-mono text-sm font-extrabold text-forest">
                      {status?.counts[opt.id] ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Server environment readiness"
                description="Managed exclusively via server environment variables & Secrets — never entered in browser UI."
                icon={<ShieldCheck size={18} />}
              />
              <div className="space-y-2.5 text-xs">
                {[
                  {
                    key: 'DATA_BACKEND',
                    value: status?.dataBackend ?? 'sqlite',
                    ready: status?.dataBackend !== 'memory',
                  },
                  ...(status?.sqlite
                    ? [
                        {
                          key: 'SQLITE_WAL_ITEMS',
                          value: `${status.sqlite.totalItems} rows · ${status.sqlite.journalMode}`,
                          ready: status.sqlite.integrityOk,
                        },
                      ]
                    : []),
                  {
                    key: 'AWS_REGION',
                    value: status?.awsRegion ?? 'ap-south-1',
                    ready: true,
                  },
                  {
                    key: 'DYNAMODB_USERS_TABLE_NAME',
                    value: status?.usersTableName ?? 'krishi360-users-dev',
                    ready: true,
                  },
                  {
                    key: 'DYNAMODB_FLAG_TABLE_NAME',
                    value: status?.flagTableName ?? 'krishi360-flag-dev',
                    ready: true,
                  },
                  {
                    key: 'AWS_ACCESS_KEY_ID / IAM_ROLE',
                    value: status?.awsCredentialsConfigured ? 'Configured on server' : 'Not set (using SQLite)',
                    ready: Boolean(status?.awsCredentialsConfigured),
                  },
                  {
                    key: 'UPLOAD_BUCKET_NAME (S3)',
                    value: status?.s3?.reachable
                      ? `${status.s3.bucketName} · ACTIVE`
                      : status?.s3UploadsConfigured
                        ? `${status.uploadBucketName} · ${status.s3?.status ?? 'PENDING'}`
                        : 'Optional / local mode',
                    ready: Boolean(status?.s3?.reachable),
                  },
                  {
                    key: 'BEDROCK_MODEL_ID',
                    value: status?.bedrockConfigured
                      ? status.bedrockModelId
                      : status?.aiProvider === 'gemini'
                        ? 'Using Gemini API'
                        : 'Not configured',
                    ready: Boolean(status?.bedrockConfigured || status?.aiProvider === 'gemini'),
                  },
                  {
                    key: 'AUTH_MODE',
                    value: status?.authMode ?? 'dev',
                    ready: true,
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line/70 bg-white/60 px-3.5 py-2.5"
                  >
                    <span className="font-mono font-bold text-ink">{item.key}</span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-muted">
                      <CheckCircle2
                        size={14}
                        className={item.ready ? 'text-forest' : 'text-line'}
                      />
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === 'records' ? (
        <Card className="mt-6">
          <CardHeader
            title="Live repository records"
            description={`Showing live records queried from ${
              status?.dataBackend === 'dynamodb'
                ? `AWS DynamoDB (${status.usersTableName} + ${status.flagTableName})`
                : status?.dataBackend === 'sqlite'
                  ? `persistent 2-table SQLite database (${status.sqlite?.dbPath ?? '.data/krishi360.db'})`
                  : 'local Memory repository'
            }. Click any row to inspect JSON.`}
            icon={<Table2 size={18} />}
            action={
              <Button
                size="sm"
                variant="outline"
                disabled={recordsLoading}
                onClick={() => void loadRecords(selectedEntity)}
              >
                <RefreshCw size={14} className={recordsLoading ? 'animate-spin' : ''} />
                Reload
              </Button>
            }
          />
          <div className="mb-4 flex flex-wrap gap-2">
            {ENTITY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedEntity(opt.id)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                  selectedEntity === opt.id
                    ? 'bg-forest text-white'
                    : 'border border-line bg-white/70 text-ink hover:border-sage'
                }`}
              >
                {opt.label} ({status?.counts[opt.id] ?? 0})
              </button>
            ))}
          </div>
          <DataTable
            columns={recordColumns}
            rows={records}
            rowKey={(row) => String(row.id ?? Math.random())}
            onRowClick={(row) => setInspectedRecord(row)}
            emptyMessage={
              recordsLoading
                ? 'Loading records from database...'
                : 'No records found in this collection yet. Use Seed Missing to populate sample entries.'
            }
          />
        </Card>
      ) : null}

      {activeTab === 'endpoints' ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader
              title="Connected Express & Lambda API routes"
              description="Execute live authenticated requests against the backend server."
              icon={<Terminal size={18} />}
            />
            <DataTable
              columns={endpointColumns}
              rows={status?.endpoints ?? []}
              rowKey={(ep) => `${ep.method}:${ep.path}`}
              compact
            />
          </Card>

          <Card>
            <CardHeader
              title="Response inspector"
              description={testedPath ? `Last tested: ${testedPath}` : 'Click Run GET on any endpoint to inspect live JSON.'}
              icon={<Server size={18} />}
            />
            {testResult ? (
              <div>
                <div className="mb-3 flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-forest">{testResult.path}</span>
                  <Badge tone="sage">{testResult.durationMs} ms</Badge>
                </div>
                <pre className="scroll-thin max-h-[420px] overflow-auto rounded-2xl bg-[#1F2B20] p-4 font-mono text-[11px] leading-relaxed text-[#E9F1EA]">
                  {JSON.stringify(testResult.payload, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-line bg-white/50 px-5 py-12 text-center text-xs text-muted">
                No endpoint tested yet. Click <span className="font-bold text-ink">Run GET</span> on any route on the left.
              </div>
            )}
          </Card>
        </div>
      ) : null}

      <Modal
        open={Boolean(inspectedRecord)}
        onClose={() => setInspectedRecord(null)}
        title={`Record JSON · ${String(inspectedRecord?.id ?? '')}`}
        description={`Entity: ${selectedEntity}`}
        size="lg"
      >
        <pre className="scroll-thin max-h-[460px] overflow-auto rounded-2xl bg-[#1F2B20] p-4 font-mono text-xs leading-relaxed text-[#E9F1EA]">
          {JSON.stringify(inspectedRecord, null, 2)}
        </pre>
      </Modal>
    </div>
  )
}
