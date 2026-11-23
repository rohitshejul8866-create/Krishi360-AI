import { apiClient } from './apiClient'

export type BackendEntityName =
  | 'cropCases'
  | 'mandiPrices'
  | 'schemes'
  | 'storageBatches'
  | 'farms'
  | 'auditLogs'

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

export interface BackendEndpointInfo {
  method: 'GET' | 'POST'
  path: string
  module: string
  auth: 'Public' | 'Authenticated' | 'Expert / Admin' | 'Admin only'
  description: string
}

export interface BackendStatusSnapshot {
  service: string
  dataBackend: 'memory' | 'dynamodb'
  awsRegion: string
  tableName: string
  customEndpointConfigured: boolean
  awsCredentialsConfigured: boolean
  s3UploadsConfigured: boolean
  aiProvider: 'disabled' | 'heuristic' | 'bedrock'
  authMode: 'dev' | 'cognito'
  dynamo: DynamoTableInspection
  counts: Record<BackendEntityName, number>
  singleTableSchema: Array<{
    entity: string
    pkPattern: string
    skPattern: string
    gsi1: string
    gsi2: string
  }>
  endpoints: BackendEndpointInfo[]
  checkedAt: string
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

  async ensureTable(): Promise<BackendStatusSnapshot> {
    const res = await apiClient.post<BackendStatusSnapshot>('/backend/ensure-table')
    return res.data
  },

  async seedDatabase(): Promise<BackendStatusSnapshot> {
    const res = await apiClient.post<BackendStatusSnapshot>('/backend/seed')
    return res.data
  },

  async listRecords(entity: BackendEntityName, limit = 15): Promise<BackendRecordsPage> {
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
