import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { DEMO_AUDIT_LOGS } from '../data/auditLogs'
import { DEMO_CASES } from '../data/cropCases'
import { DEMO_IRRIGATION_SCHEDULE } from '../data/irrigation'
import { DEMO_MANDI_PRICES } from '../data/mandiPrices'
import { DEMO_NOTIFICATIONS } from '../data/notifications'
import { DEMO_SCHEMES } from '../data/schemes'
import { DEMO_STORAGE_BATCHES } from '../data/storage'
import { DEMO_USERS } from '../data/users'
import type {
  AuditLog,
  CropCase,
  DemoUser,
  IrrigationSchedule,
  MandiAlert,
  MandiPrice,
  NotificationItem,
  PlatformSettings,
  ReviewStatus,
  Role,
  Scheme,
  SchemeApplication,
  Severity,
  StorageBatch,
  StorageStatus,
  UserStatus,
} from '../types'
import { apiClient, type DevAuthOverride } from './apiClient'
import {
  mapAuditEntry,
  mapCropCase,
  mapMandiPrice,
  mapScheme,
  mapStorageBatch,
  type BackendAuditEntry,
  type BackendCropCase,
  type BackendEligibilityResult,
  type BackendFarm,
  type BackendInspection,
  type BackendMandiPrice,
  type BackendPaginated,
  type BackendSoilReading,
  type BackendStorageBatch,
} from './apiMappers'
import { makeId } from './utils'

export interface MandiPriceCreateInput {
  crop: string
  state: string
  district: string
  mandi: string
  minPrice: number
  maxPrice: number
  modalPrice: number
  date: string
  source: string
  dataType: 'sample' | 'verified'
  changePct?: number
}

export interface SoilReadingCreateInput {
  plotId: string
  soilMoisture: number
  source: 'manual' | 'simulated'
  weather?: { condition: string; temperatureC?: number; rainfallMm?: number }
  notes?: string
}

export interface EligibilityProfileInput {
  state?: string
  landHoldingHa?: number
  annualIncomeINR?: number
  age?: number
  category?: string
  gender?: string
}

interface AppState {
  cases: CropCase[]
  mandiPrices: MandiPrice[]
  schemes: Scheme[]
  farms: BackendFarm[]
  soilReadings: BackendSoilReading[]
  savedSchemeIds: string[]
  applications: SchemeApplication[]
  notifications: NotificationItem[]
  storageBatches: StorageBatch[]
  mandiAlerts: MandiAlert[]
  irrigationSchedules: IrrigationSchedule[]
  users: DemoUser[]
  auditLogs: AuditLog[]
  settings: PlatformSettings
  backendConnected: boolean
}

interface AppContextValue extends AppState {
  syncBackendData: (authUser?: DevAuthOverride | null) => Promise<void>
  addCase: (cropCase: CropCase) => void
  reviewCase: (id: string, notes: string, guidance: string, status: ReviewStatus, reviewer: string) => void
  saveScheme: (schemeId: string) => void
  unsaveScheme: (schemeId: string) => void
  startApplication: (schemeId: string, farmerId: string) => void
  advanceApplication: (applicationId: string) => void
  checkSchemeEligibility: (schemeId: string, profile: EligibilityProfileInput) => Promise<BackendEligibilityResult>
  notify: (input: { title: string; body: string; severity: Severity; audience: Role | 'all' }) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: (audience: Role | 'all') => void
  addStorageBatch: (batch: StorageBatch) => Promise<StorageBatch>
  addInspection: (batchId: string, notes: string, inspector: string) => Promise<void>
  addStorageReading: (
    batchId: string,
    tempC: number,
    humidity: number,
    source?: 'manual' | 'simulated',
  ) => Promise<{ batchStatus: StorageStatus }>
  addMandiPrice: (input: MandiPriceCreateInput) => Promise<MandiPrice>
  logSoilReading: (farmId: string, input: SoilReadingCreateInput) => Promise<BackendSoilReading>
  addMandiAlert: (alert: Omit<MandiAlert, 'id' | 'createdAt'>) => void
  removeMandiAlert: (id: string) => void
  toggleReminder: (id: string) => void
  updateUserStatus: (id: string, status: UserStatus) => void
  addUser: (user: DemoUser) => void
  createUserAccount: (input: {
    name: string
    email: string
    password: string
    role: Role
    location: string
    phone: string
    specialisation?: string
  }) => Promise<DemoUser>
  addAuditLog: (actor: string, role: Role, action: string, target: string) => void
  updateSettings: (patch: Partial<PlatformSettings>) => void
}

const initialState: AppState = {
  cases: DEMO_CASES,
  mandiPrices: DEMO_MANDI_PRICES,
  schemes: DEMO_SCHEMES,
  farms: [],
  soilReadings: [],
  savedSchemeIds: ['scheme-02', 'scheme-07'],
  applications: [
    {
      id: 'app-001',
      schemeId: 'scheme-02',
      farmerId: 'farmer-001',
      progress: 50,
      stage: 'Application preparation',
      updatedAt: '2026-11-20T10:00:00.000Z',
    },
  ],
  notifications: DEMO_NOTIFICATIONS,
  storageBatches: DEMO_STORAGE_BATCHES,
  mandiAlerts: [
    { id: 'alert-01', crop: 'Tomato', district: 'Nashik', targetPrice: 1900, createdAt: '2026-11-19T08:00:00.000Z' },
  ],
  irrigationSchedules: DEMO_IRRIGATION_SCHEDULE,
  users: DEMO_USERS,
  auditLogs: DEMO_AUDIT_LOGS,
  settings: {
    language: 'English',
    notificationsEnabled: true,
    demoMode: true,
    compactTables: false,
    expertReviewSlaHours: 24,
    storageAlertTemp: 28,
    storageAlertHumidity: 70,
  },
  backendConnected: false,
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState)

  const addAuditLog = useCallback((actor: string, role: Role, action: string, target: string) => {
    setState((current) => ({
      ...current,
      auditLogs: [
        {
          id: makeId('LOG'),
          actor,
          role,
          action,
          target,
          timestamp: new Date().toISOString(),
        },
        ...current.auditLogs,
      ],
    }))
  }, [])

  const syncBackendData = useCallback(async (authUser?: DevAuthOverride | null) => {
    if (!authUser) {
      setState((current) => ({ ...current, backendConnected: false }))
      return
    }
    try {
      const [casesRes, mandiRes, schemesRes, storageRes, farmsRes, auditRes, usersRes] = await Promise.all([
        apiClient.get<BackendPaginated<BackendCropCase>>('/crop-cases?limit=100', authUser),
        apiClient.get<BackendPaginated<BackendMandiPrice>>('/mandi/prices?limit=100', authUser),
        apiClient.get<BackendPaginated<Scheme & Record<string, unknown>>>('/schemes?limit=100', authUser),
        apiClient.get<BackendPaginated<BackendStorageBatch>>('/storage-batches?limit=100', authUser),
        apiClient.get<BackendPaginated<BackendFarm>>('/farms?limit=20', authUser),
        authUser.role === 'admin'
          ? apiClient.get<BackendPaginated<BackendAuditEntry>>('/audit-logs?limit=100', authUser)
          : Promise.resolve(null),
        authUser.role === 'admin'
          ? apiClient.get<BackendPaginated<DemoUser>>('/admin/users?limit=100', authUser)
          : Promise.resolve(null),
      ])

      const batchDetails = await Promise.all(
        storageRes.data.items.map(async (b) => {
          try {
            const detail = await apiClient.get<{ batch: BackendStorageBatch; inspections: BackendInspection[] }>(
              `/storage-batches/${encodeURIComponent(b.id)}`,
              authUser,
            )
            return mapStorageBatch(detail.data.batch, detail.data.inspections)
          } catch {
            return mapStorageBatch(b, [])
          }
        }),
      )

      let soilReadings: BackendSoilReading[] = []
      const firstFarm = farmsRes.data.items[0]
      if (firstFarm) {
        try {
          const readingsRes = await apiClient.get<BackendPaginated<BackendSoilReading>>(
            `/farms/${encodeURIComponent(firstFarm.id)}/readings?limit=50`,
            authUser,
          )
          soilReadings = readingsRes.data.items
        } catch {
          soilReadings = []
        }
      }

      setState((current) => ({
        ...current,
        backendConnected: true,
        cases: casesRes.data.items.map(mapCropCase),
        mandiPrices: mandiRes.data.items.map(mapMandiPrice),
        schemes: schemesRes.data.items.map(mapScheme),
        farms: farmsRes.data.items,
        soilReadings,
        storageBatches: batchDetails.length > 0 || authUser.role !== 'expert' ? batchDetails : current.storageBatches,
        auditLogs: auditRes ? auditRes.data.items.map(mapAuditEntry) : current.auditLogs,
        users: usersRes ? usersRes.data.items : current.users,
      }))
    } catch {
      setState((current) => ({ ...current, backendConnected: false }))
    }
  }, [])

  const reviewCase = useCallback(
    (id: string, notes: string, guidance: string, status: ReviewStatus, reviewer: string) => {
      const apiStatus: 'in_review' | 'completed' | 'needs_info' =
        status === 'pending' ? 'in_review' : status

      setState((current) => ({
        ...current,
        cases: current.cases.map((item) =>
          item.id === id
            ? {
                ...item,
                reviewStatus: apiStatus,
                status: apiStatus === 'completed' ? 'resolved' : 'expert_review',
                expertNotes: notes,
                expertGuidance: guidance,
                reviewedAt: new Date().toISOString(),
                reviewedBy: reviewer,
              }
            : item,
        ),
      }))

      void apiClient
        .post<BackendCropCase>(`/crop-cases/${encodeURIComponent(id)}/expert-review`, {
          notes: notes.trim() || 'Reviewed in portal.',
          guidance: guidance.trim(),
          status: apiStatus,
        })
        .then((res) => {
          const mapped = mapCropCase(res.data)
          setState((current) => ({
            ...current,
            cases: current.cases.map((item) => (item.id === id ? mapped : item)),
          }))
        })
        .catch(() => {
          // Keep optimistic local update if backend role isn't expert/admin
        })
    },
    [],
  )

  const addStorageBatch = useCallback(async (batch: StorageBatch): Promise<StorageBatch> => {
    try {
      const res = await apiClient.post<BackendStorageBatch>('/storage-batches', {
        code: batch.code,
        crop: batch.crop,
        quantityKg: batch.quantityKg,
        location: batch.location,
        thresholds: {
          minTempC: batch.minTemp,
          maxTempC: batch.maxTemp,
          maxHumidity: batch.maxHumidity,
        },
        initialReading: {
          tempC: batch.tempC,
          humidity: batch.humidity,
          source: 'simulated',
        },
      })
      const created = mapStorageBatch(res.data, [])
      setState((current) => ({ ...current, storageBatches: [created, ...current.storageBatches] }))
      return created
    } catch {
      setState((current) => ({ ...current, storageBatches: [batch, ...current.storageBatches] }))
      return batch
    }
  }, [])

  const addInspection = useCallback(async (batchId: string, notes: string, inspector: string) => {
    let condition: StorageStatus = 'normal'
    setState((current) => {
      const target = current.storageBatches.find((b) => b.id === batchId)
      if (target) condition = target.status
      return {
        ...current,
        storageBatches: current.storageBatches.map((batch) =>
          batch.id === batchId
            ? {
                ...batch,
                inspections: [
                  {
                    id: makeId('INSP'),
                    date: new Date().toISOString(),
                    inspector,
                    notes,
                    condition: batch.status,
                  },
                  ...batch.inspections,
                ],
              }
            : batch,
        ),
      }
    })

    try {
      const res = await apiClient.post<BackendInspection>(
        `/storage-batches/${encodeURIComponent(batchId)}/inspections`,
        { notes, condition },
      )
      setState((current) => ({
        ...current,
        storageBatches: current.storageBatches.map((batch) => {
          if (batch.id !== batchId) return batch
          const rest = batch.inspections.slice(1)
          return {
            ...batch,
            inspections: [
              {
                id: res.data.id,
                date: res.data.createdAt,
                inspector: res.data.inspectorName ?? inspector,
                notes: res.data.notes,
                condition: res.data.condition,
              },
              ...rest,
            ],
          }
        }),
      }))
    } catch {
      // Keep optimistic inspection entry
    }
  }, [])

  const addStorageReading = useCallback(
    async (
      batchId: string,
      tempC: number,
      humidity: number,
      source: 'manual' | 'simulated' = 'simulated',
    ): Promise<{ batchStatus: StorageStatus }> => {
      const res = await apiClient.post<{
        batchStatus: StorageStatus
      }>(`/storage-batches/${encodeURIComponent(batchId)}/readings`, {
        tempC,
        humidity,
        source,
      })

      setState((current) => ({
        ...current,
        storageBatches: current.storageBatches.map((batch) =>
          batch.id === batchId
            ? { ...batch, tempC, humidity, status: res.data.batchStatus }
            : batch,
        ),
      }))
      return { batchStatus: res.data.batchStatus }
    },
    [],
  )

  const addMandiPrice = useCallback(async (input: MandiPriceCreateInput): Promise<MandiPrice> => {
    const res = await apiClient.post<BackendMandiPrice>('/mandi/prices', {
      ...input,
      unit: 'INR/quintal',
    })
    const mapped = mapMandiPrice(res.data)
    setState((current) => ({
      ...current,
      mandiPrices: [mapped, ...current.mandiPrices],
    }))
    return mapped
  }, [])

  const logSoilReading = useCallback(
    async (farmId: string, input: SoilReadingCreateInput): Promise<BackendSoilReading> => {
      const res = await apiClient.post<BackendSoilReading>(
        `/farms/${encodeURIComponent(farmId)}/readings`,
        input,
      )
      setState((current) => ({
        ...current,
        soilReadings: [res.data, ...current.soilReadings],
      }))
      return res.data
    },
    [],
  )

  const checkSchemeEligibility = useCallback(
    async (schemeId: string, profile: EligibilityProfileInput): Promise<BackendEligibilityResult> => {
      const res = await apiClient.post<BackendEligibilityResult>('/schemes/eligibility-check', {
        schemeId,
        profile,
      })
      return res.data
    },
    [],
  )

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      syncBackendData,
      addCase: (cropCase) =>
        setState((current) => ({
          ...current,
          cases: [cropCase, ...current.cases.filter((item) => item.id !== cropCase.id)],
        })),
      reviewCase,
      saveScheme: (schemeId) =>
        setState((current) =>
          current.savedSchemeIds.includes(schemeId)
            ? current
            : { ...current, savedSchemeIds: [...current.savedSchemeIds, schemeId] },
        ),
      unsaveScheme: (schemeId) =>
        setState((current) => ({
          ...current,
          savedSchemeIds: current.savedSchemeIds.filter((id) => id !== schemeId),
        })),
      startApplication: (schemeId, farmerId) =>
        setState((current) =>
          current.applications.some((app) => app.schemeId === schemeId && app.farmerId === farmerId)
            ? current
            : {
                ...current,
                applications: [
                  {
                    id: makeId('APP'),
                    schemeId,
                    farmerId,
                    progress: 25,
                    stage: 'Documents checklist',
                    updatedAt: new Date().toISOString(),
                  },
                  ...current.applications,
                ],
              },
        ),
      advanceApplication: (applicationId) =>
        setState((current) => ({
          ...current,
          applications: current.applications.map((app) => {
            if (app.id !== applicationId || app.progress >= 100) return app
            const progress = Math.min(100, app.progress + 25)
            const stage =
              progress >= 100
                ? 'Submitted (demo)'
                : progress >= 75
                  ? 'Application preparation'
                  : progress >= 50
                    ? 'Documents checklist'
                    : 'Details review'
            return { ...app, progress, stage, updatedAt: new Date().toISOString() }
          }),
        })),
      checkSchemeEligibility,
      notify: ({ title, body, severity, audience }) =>
        setState((current) => ({
          ...current,
          notifications: [
            {
              id: makeId('NOTIF'),
              title,
              body,
              severity,
              audience,
              createdAt: new Date().toISOString(),
              read: false,
            },
            ...current.notifications,
          ],
        })),
      markNotificationRead: (id) =>
        setState((current) => ({
          ...current,
          notifications: current.notifications.map((item) =>
            item.id === id ? { ...item, read: true } : item,
          ),
        })),
      markAllNotificationsRead: (audience) =>
        setState((current) => ({
          ...current,
          notifications: current.notifications.map((item) =>
            item.audience === audience || item.audience === 'all' ? { ...item, read: true } : item,
          ),
        })),
      addStorageBatch,
      addInspection,
      addStorageReading,
      addMandiPrice,
      logSoilReading,
      addMandiAlert: (alert) =>
        setState((current) => ({
          ...current,
          mandiAlerts: [
            { ...alert, id: makeId('ALERT'), createdAt: new Date().toISOString() },
            ...current.mandiAlerts,
          ],
        })),
      removeMandiAlert: (id) =>
        setState((current) => ({
          ...current,
          mandiAlerts: current.mandiAlerts.filter((alert) => alert.id !== id),
        })),
      toggleReminder: (id) =>
        setState((current) => ({
          ...current,
          irrigationSchedules: current.irrigationSchedules.map((item) =>
            item.id === id ? { ...item, reminder: !item.reminder } : item,
          ),
        })),
      updateUserStatus: (id, status) => {
        setState((current) => ({
          ...current,
          users: current.users.map((user) => (user.id === id ? { ...user, status } : user)),
        }))
        void apiClient.post<DemoUser>(`/admin/users/${encodeURIComponent(id)}/status`, { status }).catch(() => {
          // Keep optimistic status if offline/non-admin
        })
      },
      addUser: (user) =>
        setState((current) => ({
          ...current,
          users: [user, ...current.users.filter((existing) => existing.id !== user.id)],
        })),
      createUserAccount: async (input) => {
        const res = await apiClient.post<DemoUser>('/admin/users', input)
        setState((current) => ({
          ...current,
          users: [res.data, ...current.users.filter((existing) => existing.id !== res.data.id)],
        }))
        return res.data
      },
      addAuditLog,
      updateSettings: (patch) =>
        setState((current) => ({ ...current, settings: { ...current.settings, ...patch } })),
    }),
    [
      state,
      syncBackendData,
      reviewCase,
      checkSchemeEligibility,
      addStorageBatch,
      addInspection,
      addStorageReading,
      addMandiPrice,
      logSoilReading,
      addAuditLog,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
