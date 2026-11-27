import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DEMO_MANDI_PRICES } from '../data/mandiPrices'
import { DEMO_SCHEMES } from '../data/schemes'
import { auth } from '../lib/firebase'
import type {
  AuditLog,
  CropCase,
  DemoUser,
  IrrigationRecommendation,
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
import { apiClient, getAuthToken, type DevAuthOverride } from './apiClient'
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
  type BackendWorkspaceSnapshot,
} from './apiMappers'
import {
  createFirebaseCropCase,
  createFirebaseFarm,
  createFirebaseNotification,
  createFirebaseStorageBatch,
  fetchUserFirestoreSnapshot,
  logFirebaseSoilReading,
  markFirebaseNotificationRead,
  updateFirebaseFarm,
  updateFirebaseStorageBatchReading,
  updateFirebaseStorageInspections,
  updateFirebaseWorkspaceField,
} from './firestoreService'
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

export interface FarmCreateInput {
  name: string
  location: string
  areaHa: number
  soilType: string
  irrigationType: string
  plots: BackendFarm['plots']
  centerLat?: number
  centerLng?: number
}

export interface FarmUpdateInput {
  name?: string
  location?: string
  areaHa?: number
  soilType?: string
  irrigationType?: string
  centerLat?: number
  centerLng?: number
  plots?: BackendFarm['plots']
}

export interface EligibilityProfileInput {
  state?: string
  landHoldingHa?: number
  annualIncomeINR?: number
  age?: number
  category?: string
  gender?: string
}

export interface SchemeCreateInput {
  id?: string
  name: string
  category: string
  state: string
  summary: string
  eligibility: string[]
  documents: string[]
  sourceLabel: string
  sourceUrl: string
  tags: string[]
  dataType?: 'sample' | 'verified'
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
  customCrops: string[]
  users: DemoUser[]
  auditLogs: AuditLog[]
  settings: PlatformSettings
  backendConnected: boolean
}

interface AppContextValue extends AppState {
  syncBackendData: (authUser?: DevAuthOverride | null) => Promise<void>
  addCase: (cropCase: CropCase) => void
  saveCropCase: (cropCase: CropCase) => Promise<CropCase>
  reviewCase: (id: string, notes: string, guidance: string, status: ReviewStatus, reviewer: string) => void
  saveScheme: (schemeId: string) => Promise<void>
  unsaveScheme: (schemeId: string) => Promise<void>
  startApplication: (schemeId: string, farmerId: string) => Promise<void>
  advanceApplication: (applicationId: string) => Promise<void>
  createScheme: (input: SchemeCreateInput) => Promise<Scheme>
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
  createFarm: (input: FarmCreateInput) => Promise<BackendFarm>
  updateFarm: (farmId: string, patch: FarmUpdateInput) => Promise<BackendFarm>
  updateFarmPlots: (farmId: string, plots: BackendFarm['plots']) => Promise<BackendFarm>
  addCustomCrop: (cropName: string) => Promise<void>
  removeCustomCrop: (cropName: string) => Promise<void>
  addMandiAlert: (alert: Omit<MandiAlert, 'id' | 'createdAt'>) => Promise<void>
  removeMandiAlert: (id: string) => Promise<void>
  addIrrigationSchedule: (schedule: Omit<IrrigationSchedule, 'id'>) => Promise<void>
  toggleReminder: (id: string) => Promise<void>
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
  updateSettings: (patch: Partial<PlatformSettings>) => Promise<void>
}

const initialState: AppState = {
  cases: [],
  mandiPrices: DEMO_MANDI_PRICES,
  schemes: DEMO_SCHEMES,
  farms: [],
  soilReadings: [],
  savedSchemeIds: [],
  applications: [],
  notifications: [],
  storageBatches: [],
  mandiAlerts: [],
  irrigationSchedules: [],
  customCrops: [],
  users: [],
  auditLogs: [],
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

function isFirebaseSession(): boolean {
  return !getAuthToken() && Boolean(auth.currentUser)
}

function getFirebaseUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Your Firebase session is not active. Please sign in again to save changes.')
  return uid
}

function computeLocalIrrigationRecommendation(input: SoilReadingCreateInput): IrrigationRecommendation {
  const moisture = input.soilMoisture
  const rainExpected = (input.weather?.rainfallMm ?? 0) >= 8 || input.weather?.condition.toLowerCase().includes('rain')
  if (rainExpected || moisture >= 60) {
    return {
      headline: rainExpected ? 'Hold irrigation — rainfall expected' : 'Hold irrigation — moisture adequate',
      action: 'hold',
      waterLitres: 0,
      durationMin: 0,
      bestWindow: 'Re-check moisture in 24 hours',
      reasoning: [
        `Recorded soil moisture is ${moisture}%.`,
        rainExpected ? 'Weather input indicates incoming rainfall.' : 'Moisture is above optimal threshold.',
      ],
      confidenceNote: 'Saved advisory estimate. Confirm local soil conditions in the field.',
    }
  }
  if (moisture < 30) {
    return {
      headline: 'Irrigate soon — moisture low',
      action: 'irrigate-now',
      waterLitres: 3200,
      durationMin: 45,
      bestWindow: 'Early morning (06:00–08:30)',
      reasoning: [
        `Soil moisture dropped to ${moisture}%, below target range.`,
        'Early morning scheduling reduces evaporation loss.',
      ],
      confidenceNote: 'Saved advisory estimate. Confirm local soil conditions in the field.',
    }
  }
  return {
    headline: 'Schedule light irrigation',
    action: 'schedule',
    waterLitres: 1800,
    durationMin: 25,
    bestWindow: 'Tomorrow morning (06:30–08:00)',
    reasoning: [`Moderate moisture level (${moisture}%). Light replenishment keeps root zone balanced.`],
    confidenceNote: 'Saved advisory estimate. Confirm local soil conditions in the field.',
  }
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState)
  const stateRef = useRef(state)
  const activeRoleRef = useRef<Role | null>(null)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const persistWorkspace = useCallback(
    async (patch: {
      savedSchemeIds?: string[]
      applications?: SchemeApplication[]
      mandiAlerts?: MandiAlert[]
      irrigationSchedules?: IrrigationSchedule[]
      customCrops?: string[]
      preferences?: {
        language?: string
        notificationsEnabled?: boolean
        compactTables?: boolean
        expertReviewSlaHours?: number
      }
    }): Promise<void> => {
      if (isFirebaseSession()) {
        const uid = getFirebaseUid()
        if (patch.savedSchemeIds !== undefined) {
          await updateFirebaseWorkspaceField(uid, 'savedSchemeIds', patch.savedSchemeIds)
        }
        if (patch.applications !== undefined) {
          await updateFirebaseWorkspaceField(uid, 'applications', patch.applications)
        }
        if (patch.mandiAlerts !== undefined) {
          await updateFirebaseWorkspaceField(uid, 'mandiAlerts', patch.mandiAlerts)
        }
        if (patch.irrigationSchedules !== undefined) {
          await updateFirebaseWorkspaceField(uid, 'irrigationSchedules', patch.irrigationSchedules)
        }
        if (patch.customCrops !== undefined) {
          await updateFirebaseWorkspaceField(uid, 'customCrops', patch.customCrops)
        }
        if (patch.preferences !== undefined) {
          await updateFirebaseWorkspaceField(uid, 'preferences', patch.preferences)
        }
        return
      }
      if (!getAuthToken()) {
        throw new Error('Your session is not active. Please sign in again to save changes.')
      }
      await apiClient.put('/workspace', patch)
    },
    [],
  )

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
      activeRoleRef.current = null
      setState(initialState)
      return
    }
    activeRoleRef.current = (authUser.role as Role) ?? null

    if (authUser.provider === 'firebase' || isFirebaseSession()) {
      try {
        const uid = auth.currentUser?.uid || authUser.id
        const fsSnap = await fetchUserFirestoreSnapshot(uid)
        setState((current) => ({
          ...current,
          backendConnected: true,
          cases: fsSnap.cases,
          farms: fsSnap.farms,
          soilReadings: fsSnap.soilReadings,
          storageBatches: fsSnap.storageBatches,
          savedSchemeIds: fsSnap.savedSchemeIds,
          applications: fsSnap.applications,
          mandiAlerts: fsSnap.mandiAlerts,
          irrigationSchedules: fsSnap.irrigationSchedules,
          customCrops: fsSnap.customCrops,
          notifications: fsSnap.notifications,
          settings: {
            ...current.settings,
            language: fsSnap.preferences.language ?? current.settings.language,
            notificationsEnabled:
              fsSnap.preferences.notificationsEnabled ?? current.settings.notificationsEnabled,
            compactTables: fsSnap.preferences.compactTables ?? current.settings.compactTables,
            expertReviewSlaHours:
              fsSnap.preferences.expertReviewSlaHours ?? current.settings.expertReviewSlaHours,
          },
        }))
      } catch (err) {
        console.error('Firestore workspace sync failed:', err)
        setState((current) => ({ ...current, backendConnected: false }))
      }
      return
    }

    try {
      const [casesRes, mandiRes, schemesRes, storageRes, farmsRes, workspaceRes, auditRes, usersRes] =
        await Promise.allSettled([
          apiClient.get<BackendPaginated<BackendCropCase>>('/crop-cases?limit=100', authUser),
          apiClient.get<BackendPaginated<BackendMandiPrice>>('/mandi/prices?limit=100', authUser),
          apiClient.get<BackendPaginated<Scheme & Record<string, unknown>>>('/schemes?limit=100', authUser),
          apiClient.get<BackendPaginated<BackendStorageBatch>>('/storage-batches?limit=100', authUser),
          apiClient.get<BackendPaginated<BackendFarm>>('/farms?limit=20', authUser),
          apiClient.get<BackendWorkspaceSnapshot>('/workspace', authUser),
          authUser.role === 'admin'
            ? apiClient.get<BackendPaginated<BackendAuditEntry>>('/audit-logs?limit=100', authUser)
            : Promise.resolve(null),
          authUser.role === 'admin'
            ? apiClient.get<BackendPaginated<DemoUser>>('/admin/users?limit=100', authUser)
            : Promise.resolve(null),
        ])

      const settledOk = [casesRes, mandiRes, schemesRes, storageRes, farmsRes, workspaceRes].some(
        (res) => res.status === 'fulfilled',
      )
      if (!settledOk) {
        setState((current) => ({ ...current, backendConnected: false }))
        return
      }

      const storageItems = storageRes.status === 'fulfilled' ? storageRes.value.data.items : []
      const batchDetails = await Promise.all(
        storageItems.map(async (b) => {
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

      const farmsItems = farmsRes.status === 'fulfilled' ? farmsRes.value.data.items : []
      let soilReadings: BackendSoilReading[] = []
      const firstFarm = farmsItems[0]
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

      const ws = workspaceRes.status === 'fulfilled' ? workspaceRes.value?.data : null

      setState((current) => {
        const baseSettings = ws ? ws.settings : current.settings
        const prefs = ws?.workspace.preferences
        const nextSettings: PlatformSettings =
          authUser.role !== 'admin' && prefs
            ? {
                ...baseSettings,
                language: prefs.language ?? baseSettings.language,
                notificationsEnabled: prefs.notificationsEnabled ?? baseSettings.notificationsEnabled,
                compactTables: prefs.compactTables ?? baseSettings.compactTables,
                expertReviewSlaHours: prefs.expertReviewSlaHours ?? baseSettings.expertReviewSlaHours,
              }
            : baseSettings

        return {
          ...current,
          backendConnected: true,
          cases: casesRes.status === 'fulfilled' ? casesRes.value.data.items.map(mapCropCase) : current.cases,
          mandiPrices:
            mandiRes.status === 'fulfilled' ? mandiRes.value.data.items.map(mapMandiPrice) : current.mandiPrices,
          schemes: schemesRes.status === 'fulfilled' ? schemesRes.value.data.items.map(mapScheme) : current.schemes,
          farms: farmsRes.status === 'fulfilled' ? farmsItems : current.farms,
          soilReadings,
          storageBatches: storageRes.status === 'fulfilled' ? batchDetails : current.storageBatches,
          auditLogs:
            auditRes.status === 'fulfilled' && auditRes.value
              ? auditRes.value.data.items.map(mapAuditEntry)
              : [],
          users:
            usersRes.status === 'fulfilled' && usersRes.value ? usersRes.value.data.items : [],
          savedSchemeIds: ws ? ws.workspace.savedSchemeIds : current.savedSchemeIds,
          applications: ws ? ws.workspace.applications : current.applications,
          mandiAlerts: ws ? ws.workspace.mandiAlerts : current.mandiAlerts,
          irrigationSchedules: ws ? ws.workspace.irrigationSchedules : current.irrigationSchedules,
          customCrops: ws?.workspace.customCrops ?? current.customCrops,
          notifications: ws ? ws.notifications : current.notifications,
          settings: nextSettings,
        }
      })
    } catch {
      setState((current) => ({ ...current, backendConnected: false }))
    }
  }, [])

  const saveCropCase = useCallback(async (cropCase: CropCase): Promise<CropCase> => {
    if (isFirebaseSession()) {
      const uid = getFirebaseUid()
      const created = await createFirebaseCropCase(uid, cropCase)
      setState((current) => ({
        ...current,
        cases: [created, ...current.cases.filter((item) => item.id !== created.id)],
      }))
      return created
    }
    setState((current) => ({
      ...current,
      cases: [cropCase, ...current.cases.filter((item) => item.id !== cropCase.id)],
    }))
    return cropCase
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

      if (getAuthToken()) {
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
          .catch(() => {})
      }
    },
    [],
  )

  const addStorageBatch = useCallback(async (batch: StorageBatch): Promise<StorageBatch> => {
    if (isFirebaseSession()) {
      const uid = getFirebaseUid()
      const created = await createFirebaseStorageBatch(uid, batch)
      setState((current) => ({ ...current, storageBatches: [created, ...current.storageBatches] }))
      return created
    }
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
  }, [])

  const addInspection = useCallback(async (batchId: string, notes: string, inspector: string) => {
    const prevBatches = stateRef.current.storageBatches
    const target = prevBatches.find((b) => b.id === batchId)
    const condition: StorageStatus = target?.status ?? 'normal'
    const tempId = makeId('INSP')
    const newInspection = {
      id: tempId,
      date: new Date().toISOString(),
      inspector,
      notes,
      condition,
    }
    const nextBatches = prevBatches.map((batch) =>
      batch.id === batchId
        ? { ...batch, inspections: [newInspection, ...batch.inspections] }
        : batch,
    )
    setState((current) => ({ ...current, storageBatches: nextBatches }))

    try {
      if (isFirebaseSession()) {
        const uid = getFirebaseUid()
        const updatedBatch = nextBatches.find((b) => b.id === batchId)
        await updateFirebaseStorageInspections(uid, batchId, updatedBatch?.inspections ?? [newInspection])
        return
      }
      const res = await apiClient.post<BackendInspection>(
        `/storage-batches/${encodeURIComponent(batchId)}/inspections`,
        { notes, condition },
      )
      setState((current) => ({
        ...current,
        storageBatches: current.storageBatches.map((batch) => {
          if (batch.id !== batchId) return batch
          return {
            ...batch,
            inspections: batch.inspections.map((insp) =>
              insp.id === tempId
                ? {
                    id: res.data.id,
                    date: res.data.createdAt,
                    inspector: res.data.inspectorName ?? inspector,
                    notes: res.data.notes,
                    condition: res.data.condition,
                  }
                : insp,
            ),
          }
        }),
      }))
    } catch (err) {
      setState((current) => ({ ...current, storageBatches: prevBatches }))
      throw err
    }
  }, [])

  const addStorageReading = useCallback(
    async (
      batchId: string,
      tempC: number,
      humidity: number,
      source: 'manual' | 'simulated' = 'simulated',
    ): Promise<{ batchStatus: StorageStatus }> => {
      if (isFirebaseSession()) {
        const uid = getFirebaseUid()
        const target = stateRef.current.storageBatches.find((b) => b.id === batchId)
        const maxTemp = target?.maxTemp ?? 28
        const minTemp = target?.minTemp ?? 4
        const maxHumidity = target?.maxHumidity ?? 70
        const batchStatus: StorageStatus =
          tempC > maxTemp || tempC < minTemp || humidity > maxHumidity
            ? 'critical'
            : tempC > maxTemp - 2 || humidity > maxHumidity - 5
              ? 'warning'
              : 'normal'
        await updateFirebaseStorageBatchReading(uid, batchId, tempC, humidity, batchStatus)
        setState((current) => ({
          ...current,
          storageBatches: current.storageBatches.map((batch) =>
            batch.id === batchId ? { ...batch, tempC, humidity, status: batchStatus } : batch,
          ),
        }))
        return { batchStatus }
      }

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
      if (isFirebaseSession()) {
        const uid = getFirebaseUid()
        const rec = computeLocalIrrigationRecommendation(input)
        const reading = await logFirebaseSoilReading(uid, farmId, input, rec)
        setState((current) => ({
          ...current,
          soilReadings: [reading, ...current.soilReadings],
        }))
        return reading
      }
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

  const createFarm = useCallback(async (input: FarmCreateInput): Promise<BackendFarm> => {
    if (isFirebaseSession()) {
      const uid = getFirebaseUid()
      const created = await createFirebaseFarm(uid, input)
      setState((current) => ({
        ...current,
        farms: [created, ...current.farms.filter((farm) => farm.id !== created.id)],
      }))
      return created
    }
    const res = await apiClient.post<BackendFarm>('/farms', input)
    setState((current) => ({
      ...current,
      farms: [res.data, ...current.farms.filter((farm) => farm.id !== res.data.id)],
    }))
    return res.data
  }, [])

  const updateFarm = useCallback(async (farmId: string, patch: FarmUpdateInput): Promise<BackendFarm> => {
    if (isFirebaseSession()) {
      const uid = getFirebaseUid()
      await updateFirebaseFarm(uid, farmId, patch)
      let updatedFarm: BackendFarm | null = null
      setState((current) => ({
        ...current,
        farms: current.farms.map((farm) => {
          if (farm.id !== farmId) return farm
          updatedFarm = { ...farm, ...patch }
          return updatedFarm
        }),
      }))
      return updatedFarm ?? stateRef.current.farms.find((f) => f.id === farmId)!
    }
    const res = await apiClient.put<BackendFarm>(`/farms/${encodeURIComponent(farmId)}`, patch)
    setState((current) => ({
      ...current,
      farms: current.farms.map((farm) => (farm.id === farmId ? res.data : farm)),
    }))
    return res.data
  }, [])

  const updateFarmPlots = useCallback(
    async (farmId: string, plots: BackendFarm['plots']): Promise<BackendFarm> => {
      if (isFirebaseSession()) {
        const uid = getFirebaseUid()
        const totalArea = Number(plots.reduce((sum, p) => sum + Number(p.areaHa ?? 0), 0).toFixed(2))
        await updateFirebaseFarm(uid, farmId, { plots, areaHa: totalArea })
        let updatedFarm: BackendFarm | null = null
        setState((current) => ({
          ...current,
          farms: current.farms.map((farm) => {
            if (farm.id !== farmId) return farm
            updatedFarm = { ...farm, plots, areaHa: totalArea }
            return updatedFarm
          }),
        }))
        return updatedFarm ?? stateRef.current.farms.find((f) => f.id === farmId)!
      }
      const totalArea = Number(plots.reduce((sum, p) => sum + Number(p.areaHa ?? 0), 0).toFixed(2))
      const res = await apiClient.put<BackendFarm>(`/farms/${encodeURIComponent(farmId)}`, {
        plots,
        areaHa: totalArea,
      })
      setState((current) => ({
        ...current,
        farms: current.farms.map((farm) => (farm.id === farmId ? res.data : farm)),
      }))
      return res.data
    },
    [],
  )

  const addCustomCrop = useCallback(
    async (cropName: string) => {
      const clean = cropName.trim()
      if (!clean) return
      const prev = stateRef.current.customCrops
      if (prev.some((c) => c.toLowerCase() === clean.toLowerCase())) return
      const next = [clean, ...prev]
      stateRef.current = { ...stateRef.current, customCrops: next }
      setState((current) => ({ ...current, customCrops: next }))
      try {
        await persistWorkspace({ customCrops: next })
      } catch (err) {
        stateRef.current = { ...stateRef.current, customCrops: prev }
        setState((current) => ({ ...current, customCrops: prev }))
        throw err
      }
    },
    [persistWorkspace],
  )

  const removeCustomCrop = useCallback(
    async (cropName: string) => {
      const prev = stateRef.current.customCrops
      const next = prev.filter((c) => c !== cropName)
      stateRef.current = { ...stateRef.current, customCrops: next }
      setState((current) => ({ ...current, customCrops: next }))
      try {
        await persistWorkspace({ customCrops: next })
      } catch (err) {
        stateRef.current = { ...stateRef.current, customCrops: prev }
        setState((current) => ({ ...current, customCrops: prev }))
        throw err
      }
    },
    [persistWorkspace],
  )

  const createScheme = useCallback(async (input: SchemeCreateInput): Promise<Scheme> => {
    const res = await apiClient.post<Scheme & Record<string, unknown>>('/schemes', {
      ...input,
      dataType: input.dataType ?? 'sample',
    })
    const mapped = mapScheme(res.data)
    setState((current) => ({
      ...current,
      schemes: [mapped, ...current.schemes.filter((s) => s.id !== mapped.id)],
    }))
    return mapped
  }, [])

  const checkSchemeEligibility = useCallback(
    async (schemeId: string, profile: EligibilityProfileInput): Promise<BackendEligibilityResult> => {
      if (isFirebaseSession()) {
        const scheme = stateRef.current.schemes.find((s) => s.id === schemeId)
        const stateMatch =
          !scheme?.state ||
          scheme.state.toLowerCase() === 'all' ||
          scheme.state.toLowerCase() === 'all india' ||
          (profile.state ?? '').toLowerCase() === scheme.state.toLowerCase()
        const landOk = (profile.landHoldingHa ?? 0) > 0
        return {
          schemeId,
          schemeName: scheme?.name ?? schemeId,
          outcome: stateMatch && landOk ? 'likely_eligible' : 'insufficient_information',
          criteria: [
            {
              description: `State applicability (${scheme?.state ?? 'All India'})`,
              result: stateMatch ? 'met' : 'not_met',
            },
            {
              description: 'Active agricultural land holding documented',
              result: landOk ? 'met' : 'unknown',
            },
          ],
          documents: scheme?.documents ?? ['Aadhaar Card', 'Land Record (7/12)'],
          sourceLabel: scheme?.sourceLabel ?? 'Official Portal',
          sourceUrl: scheme?.sourceUrl ?? 'https://www.india.gov.in/',
          lastUpdatedAt: new Date().toISOString(),
          disclaimer:
            'Indicative eligibility check only. Verify final criteria on the official scheme portal.',
        }
      }
      const res = await apiClient.post<BackendEligibilityResult>('/schemes/eligibility-check', {
        schemeId,
        profile,
      })
      return res.data
    },
    [],
  )

  const saveScheme = useCallback(
    async (schemeId: string) => {
      const prev = stateRef.current.savedSchemeIds
      if (prev.includes(schemeId)) return
      const nextIds = [...prev, schemeId]
      stateRef.current = { ...stateRef.current, savedSchemeIds: nextIds }
      setState((current) => ({ ...current, savedSchemeIds: nextIds }))
      try {
        await persistWorkspace({ savedSchemeIds: nextIds })
      } catch (err) {
        stateRef.current = { ...stateRef.current, savedSchemeIds: prev }
        setState((current) => ({ ...current, savedSchemeIds: prev }))
        throw err
      }
    },
    [persistWorkspace],
  )

  const unsaveScheme = useCallback(
    async (schemeId: string) => {
      const prev = stateRef.current.savedSchemeIds
      const nextIds = prev.filter((id) => id !== schemeId)
      stateRef.current = { ...stateRef.current, savedSchemeIds: nextIds }
      setState((current) => ({ ...current, savedSchemeIds: nextIds }))
      try {
        await persistWorkspace({ savedSchemeIds: nextIds })
      } catch (err) {
        stateRef.current = { ...stateRef.current, savedSchemeIds: prev }
        setState((current) => ({ ...current, savedSchemeIds: prev }))
        throw err
      }
    },
    [persistWorkspace],
  )

  const startApplication = useCallback(
    async (schemeId: string, farmerId: string) => {
      const prev = stateRef.current.applications
      if (prev.some((app) => app.schemeId === schemeId && app.farmerId === farmerId)) {
        return
      }
      const nextApps: SchemeApplication[] = [
        {
          id: makeId('APP'),
          schemeId,
          farmerId,
          progress: 25,
          stage: 'Documents checklist',
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ]
      stateRef.current = { ...stateRef.current, applications: nextApps }
      setState((current) => ({ ...current, applications: nextApps }))
      try {
        await persistWorkspace({ applications: nextApps })
      } catch (err) {
        stateRef.current = { ...stateRef.current, applications: prev }
        setState((current) => ({ ...current, applications: prev }))
        throw err
      }
    },
    [persistWorkspace],
  )

  const advanceApplication = useCallback(
    async (applicationId: string) => {
      const prev = stateRef.current.applications
      const nextApps = prev.map((app) => {
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
      })
      stateRef.current = { ...stateRef.current, applications: nextApps }
      setState((current) => ({ ...current, applications: nextApps }))
      try {
        await persistWorkspace({ applications: nextApps })
      } catch (err) {
        stateRef.current = { ...stateRef.current, applications: prev }
        setState((current) => ({ ...current, applications: prev }))
        throw err
      }
    },
    [persistWorkspace],
  )

  const notify = useCallback(
    (input: { title: string; body: string; severity: Severity; audience: Role | 'all' }) => {
      const tempId = makeId('NOTIF')
      const optimistic: NotificationItem = {
        id: tempId,
        ...input,
        createdAt: new Date().toISOString(),
        read: false,
      }
      setState((current) => ({
        ...current,
        notifications: [optimistic, ...current.notifications],
      }))
      if (isFirebaseSession()) {
        const uid = auth.currentUser?.uid
        if (uid) {
          void createFirebaseNotification(uid, input)
            .then((saved) => {
              setState((current) => ({
                ...current,
                notifications: current.notifications.map((n) => (n.id === tempId ? saved : n)),
              }))
            })
            .catch(() => {})
        }
        return
      }
      if (stateRef.current.backendConnected && getAuthToken()) {
        void apiClient
          .post<NotificationItem>('/notifications', input)
          .then((res) => {
            setState((current) => ({
              ...current,
              notifications: current.notifications.map((n) => (n.id === tempId ? res.data : n)),
            }))
          })
          .catch(() => {})
      }
    },
    [],
  )

  const markNotificationRead = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      notifications: current.notifications.map((item) => (item.id === id ? { ...item, read: true } : item)),
    }))
    if (isFirebaseSession()) {
      const uid = auth.currentUser?.uid
      if (uid) {
        void markFirebaseNotificationRead(uid, id).catch(() => {})
      }
      return
    }
    if (stateRef.current.backendConnected && getAuthToken()) {
      void apiClient.post('/notifications/read', { id }).catch(() => {})
    }
  }, [])

  const markAllNotificationsRead = useCallback((audience: Role | 'all') => {
    const unreadIds = stateRef.current.notifications
      .filter((item) => !item.read && (item.audience === audience || item.audience === 'all'))
      .map((item) => item.id)
    setState((current) => ({
      ...current,
      notifications: current.notifications.map((item) =>
        item.audience === audience || item.audience === 'all' ? { ...item, read: true } : item,
      ),
    }))
    if (isFirebaseSession()) {
      const uid = auth.currentUser?.uid
      if (uid) {
        unreadIds.forEach((id) => {
          void markFirebaseNotificationRead(uid, id).catch(() => {})
        })
      }
      return
    }
    if (stateRef.current.backendConnected && getAuthToken()) {
      void apiClient.post('/notifications/read', { audience }).catch(() => {})
    }
  }, [])

  const addMandiAlert = useCallback(
    async (alert: Omit<MandiAlert, 'id' | 'createdAt'>) => {
      const prev = stateRef.current.mandiAlerts
      const nextAlerts: MandiAlert[] = [
        { ...alert, id: makeId('ALERT'), createdAt: new Date().toISOString() },
        ...prev,
      ]
      stateRef.current = { ...stateRef.current, mandiAlerts: nextAlerts }
      setState((current) => ({ ...current, mandiAlerts: nextAlerts }))
      try {
        await persistWorkspace({ mandiAlerts: nextAlerts })
      } catch (err) {
        stateRef.current = { ...stateRef.current, mandiAlerts: prev }
        setState((current) => ({ ...current, mandiAlerts: prev }))
        throw err
      }
    },
    [persistWorkspace],
  )

  const removeMandiAlert = useCallback(
    async (id: string) => {
      const prev = stateRef.current.mandiAlerts
      const nextAlerts = prev.filter((alert) => alert.id !== id)
      stateRef.current = { ...stateRef.current, mandiAlerts: nextAlerts }
      setState((current) => ({ ...current, mandiAlerts: nextAlerts }))
      try {
        await persistWorkspace({ mandiAlerts: nextAlerts })
      } catch (err) {
        stateRef.current = { ...stateRef.current, mandiAlerts: prev }
        setState((current) => ({ ...current, mandiAlerts: prev }))
        throw err
      }
    },
    [persistWorkspace],
  )

  const addIrrigationSchedule = useCallback(
    async (schedule: Omit<IrrigationSchedule, 'id'>) => {
      const prev = stateRef.current.irrigationSchedules
      const nextSchedules: IrrigationSchedule[] = [
        { ...schedule, id: makeId('SCH') },
        ...prev,
      ]
      stateRef.current = { ...stateRef.current, irrigationSchedules: nextSchedules }
      setState((current) => ({ ...current, irrigationSchedules: nextSchedules }))
      try {
        await persistWorkspace({ irrigationSchedules: nextSchedules })
      } catch (err) {
        stateRef.current = { ...stateRef.current, irrigationSchedules: prev }
        setState((current) => ({ ...current, irrigationSchedules: prev }))
        throw err
      }
    },
    [persistWorkspace],
  )

  const toggleReminder = useCallback(
    async (id: string) => {
      const prev = stateRef.current.irrigationSchedules
      const nextSchedules = prev.map((item) =>
        item.id === id ? { ...item, reminder: !item.reminder } : item,
      )
      stateRef.current = { ...stateRef.current, irrigationSchedules: nextSchedules }
      setState((current) => ({ ...current, irrigationSchedules: nextSchedules }))
      try {
        await persistWorkspace({ irrigationSchedules: nextSchedules })
      } catch (err) {
        stateRef.current = { ...stateRef.current, irrigationSchedules: prev }
        setState((current) => ({ ...current, irrigationSchedules: prev }))
        throw err
      }
    },
    [persistWorkspace],
  )

  const updateSettings = useCallback(
    async (patch: Partial<PlatformSettings>) => {
      const prevSettings = stateRef.current.settings
      const merged: PlatformSettings = { ...prevSettings, ...patch }
      stateRef.current = { ...stateRef.current, settings: merged }
      setState((current) => ({ ...current, settings: merged }))

      try {
        if (isFirebaseSession()) {
          await persistWorkspace({
            preferences: {
              language: merged.language,
              notificationsEnabled: merged.notificationsEnabled,
              compactTables: merged.compactTables,
              expertReviewSlaHours: merged.expertReviewSlaHours,
            },
          })
          return
        }
        if (!getAuthToken()) {
          throw new Error('Your session is not active. Please sign in again to save settings.')
        }
        if (activeRoleRef.current === 'admin') {
          const res = await apiClient.put<PlatformSettings>('/admin/settings', {
            language: merged.language,
            notificationsEnabled: merged.notificationsEnabled,
            demoMode: merged.demoMode,
            compactTables: merged.compactTables,
            expertReviewSlaHours: merged.expertReviewSlaHours,
            storageAlertTemp: merged.storageAlertTemp,
            storageAlertHumidity: merged.storageAlertHumidity,
          })
          stateRef.current = { ...stateRef.current, settings: res.data }
          setState((current) => ({ ...current, settings: res.data }))
        } else {
          await persistWorkspace({
            preferences: {
              language: merged.language,
              notificationsEnabled: merged.notificationsEnabled,
              compactTables: merged.compactTables,
              expertReviewSlaHours: merged.expertReviewSlaHours,
            },
          })
        }
      } catch (err) {
        stateRef.current = { ...stateRef.current, settings: prevSettings }
        setState((current) => ({ ...current, settings: prevSettings }))
        throw err
      }
    },
    [persistWorkspace],
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
      saveCropCase,
      reviewCase,
      saveScheme,
      unsaveScheme,
      startApplication,
      advanceApplication,
      createScheme,
      checkSchemeEligibility,
      notify,
      markNotificationRead,
      markAllNotificationsRead,
      addStorageBatch,
      addInspection,
      addStorageReading,
      addMandiPrice,
      logSoilReading,
      createFarm,
      updateFarm,
      updateFarmPlots,
      addCustomCrop,
      removeCustomCrop,
      addMandiAlert,
      removeMandiAlert,
      addIrrigationSchedule,
      toggleReminder,
      updateUserStatus: (id, status) => {
        setState((current) => ({
          ...current,
          users: current.users.map((user) => (user.id === id ? { ...user, status } : user)),
        }))
        if (getAuthToken()) {
          void apiClient.post<DemoUser>(`/admin/users/${encodeURIComponent(id)}/status`, { status }).catch(() => {})
        }
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
      updateSettings,
    }),
    [
      state,
      syncBackendData,
      saveCropCase,
      reviewCase,
      saveScheme,
      unsaveScheme,
      startApplication,
      advanceApplication,
      createScheme,
      checkSchemeEligibility,
      notify,
      markNotificationRead,
      markAllNotificationsRead,
      addStorageBatch,
      addInspection,
      addStorageReading,
      addMandiPrice,
      logSoilReading,
      createFarm,
      updateFarm,
      updateFarmPlots,
      addCustomCrop,
      removeCustomCrop,
      addMandiAlert,
      removeMandiAlert,
      addIrrigationSchedule,
      toggleReminder,
      addAuditLog,
      updateSettings,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useAuth must be used inside AppProvider')
  return context
}
