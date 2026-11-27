import { apiClient } from './apiClient'

export type BackendEntityName =
  | 'cropCases'
  | 'mandiPrices'
  | 'schemes'
  | 'storageBatches'
  | 'farms'
  | 'auditLogs'
  | 'users'
  | 'notifications'

export type TableState =
  | 'ACTIVE'
  | 'CREATING'
  | 'UPDATING'
  | 'NOT_FOUND'
  | 'NOT_CONFIGURED'
  | 'UNREACHABLE'

export interface DynamoTableInspection {
  reachable: boolean
  tableStatus: TableState
  billingMode: string | null
  approximateItemCount: number | null
  gsiNames: string[]
  message: string
}

export interface SqliteInspection {
  dbPath: string
  exists: boolean
  journalMode: string
  integrityOk: boolean
  fileSizeBytes: number
  usersItems: number
  flagItems: number
  totalItems: number
  indexCount: number
  tables: string[]
  message: string
}

export interface BackendEndpointInfo {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  path: string
  module: string
  auth: 'Public' | 'Authenticated' | 'Expert / Admin' | 'Admin only'
  description: string
}

export interface S3BucketInspection {
  configured: boolean
  reachable: boolean
  bucketName: string
  status: 'ACTIVE' | 'NOT_FOUND' | 'NOT_CONFIGURED' | 'UNREACHABLE'
  message: string
}

export interface BackendStatusSnapshot {
  service: string
  dataBackend: 'memory' | 'sqlite' | 'dynamodb'
  awsRegion: string
  usersTableName: string
  flagTableName: string
  tableName: string
  uploadBucketName: string
  customEndpointConfigured: boolean
  awsCredentialsConfigured: boolean
  s3UploadsConfigured: boolean
  s3: S3BucketInspection
  aiProvider: 'disabled' | 'heuristic' | 'bedrock' | 'gemini'
  bedrockConfigured: boolean
  bedrockModelId: string
  authMode: 'dev' | 'session' | 'cognito'
  dynamo: DynamoTableInspection
  usersDynamo: DynamoTableInspection
  flagDynamo: DynamoTableInspection
  sqlite?: SqliteInspection
  counts: Record<BackendEntityName, number>
  singleTableSchema: Array<{
    table: 'Users Login Table' | 'Flag Data Table'
    entity: string
    pkPattern: string
    skPattern: string
    gsi1: string
    gsi2: string
  }>
  endpoints: BackendEndpointInfo[]
  checkedAt: string
  seedResult?: { inserted: number; skipped: number }
}

export interface BackendRecordsPage {
  items: Record<string, unknown>[]
  nextToken: string | null
}

export const backendService = {
  async getStatus(): Promise<BackendStatusSnapshot> {
    const res = await apiClient.get<BackendStatusSnapshot>('/backend/status')
    return res.data
  },

  async healthCheck(): Promise<BackendStatusSnapshot> {
    const res = await apiClient.post<BackendStatusSnapshot>('/backend/health-check')
    return res.data
  },

  async exportSnapshot(): Promise<Record<string, unknown>> {
    const res = await apiClient.get<Record<string, unknown>>('/backend/export')
    return res.data
  },

  async ensureTable(): Promise<BackendStatusSnapshot> {
    const res = await apiClient.post<BackendStatusSnapshot>('/backend/ensure-table')
    return res.data
  },

  async seedDatabase(mode: 'missing' | 'reset' = 'missing'): Promise<BackendStatusSnapshot> {
    const res = await apiClient.post<BackendStatusSnapshot>('/backend/seed', { mode })
    return res.data
  },

  async listRecords(entity: BackendEntityName, limit = 25): Promise<BackendRecordsPage> {
    const res = await apiClient.get<BackendRecordsPage>(
      `/backend/records?entity=${encodeURIComponent(entity)}&limit=${limit}`,
    )
    return res.data
  },

  async testGetEndpoint(path: string): Promise<{ durationMs: number; payload: unknown }> {
    const cleanPath = path.startsWith('/api/') ? path.slice(4) : path
    const started = performance.now()
    const envelope = await apiClient.get<unknown>(cleanPath)
    const durationMs = Math.round(performance.now() - started)
    return { durationMs, payload: envelope }
  },
}
