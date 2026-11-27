import type { User as FirebaseUser } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db, handleFirestoreError, OperationType } from '../lib/firebase'
import type {
  CropCase,
  DemoUser,
  GroundingSource,
  IrrigationRecommendation,
  IrrigationSchedule,
  MandiAlert,
  NotificationItem,
  PlatformSettings,
  Role,
  SchemeApplication,
  Severity,
  StorageBatch,
  StorageStatus,
} from '../types'
import type { BackendFarm, BackendSoilReading } from './apiMappers'

const BOOTSTRAPPED_ADMIN_EMAIL = 'rohitshejul5566@gmail.com'

export interface CopilotSessionRecord {
  id: string
  title: string
  mode: 'grounded' | 'fast'
  messages: Array<{
    id: string
    sender: 'user' | 'assistant'
    text: string
    time: string
    modelUsed?: string
    groundingSources?: GroundingSource[]
    safetyFiltered?: boolean
  }>
  createdAt: string
  updatedAt: string
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  if (typeof value === 'string' && value.trim()) return value
  return new Date().toISOString()
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

function safeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const workspaceInitInFlight = new Map<string, Promise<DemoUser>>()

export function ensureFirebaseUserWorkspace(fbUser: FirebaseUser): Promise<DemoUser> {
  const existingPromise = workspaceInitInFlight.get(fbUser.uid)
  if (existingPromise) {
    return existingPromise
  }
  const initPromise = runEnsureFirebaseUserWorkspace(fbUser).finally(() => {
    workspaceInitInFlight.delete(fbUser.uid)
  })
  workspaceInitInFlight.set(fbUser.uid, initPromise)
  return initPromise
}

async function runEnsureFirebaseUserWorkspace(fbUser: FirebaseUser): Promise<DemoUser> {
  const uid = fbUser.uid
  const userPath = `users/${uid}`
  const profilePath = `users/${uid}/private/profile`
  const workspacePath = `users/${uid}/workspace/state`
  const isBootstrapAdmin =
    Boolean(fbUser.emailVerified) && fbUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL

  const userRef = doc(db, 'users', uid)
  let existingRole: Role = isBootstrapAdmin ? 'admin' : 'farmer'
  let existingDisplayName = fbUser.displayName?.trim() || fbUser.email?.split('@')[0] || 'Farmer'
  let joinedAt = new Date().toISOString()

  let userSnap: Awaited<ReturnType<typeof getDoc>>
  try {
    userSnap = await getDoc(userRef)
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath)
  }

  if (!userSnap.exists()) {
    try {
      await setDoc(
        userRef,
        stripUndefined({
          uid,
          displayName: existingDisplayName.slice(0, 120),
          role: existingRole,
          photoUrl: fbUser.photoURL ? fbUser.photoURL.slice(0, 512) : undefined,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      )
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, userPath)
    }
  } else {
    const data = userSnap.data() as Record<string, unknown>
    existingRole = (data.role as Role) || existingRole
    existingDisplayName = (data.displayName as string) || existingDisplayName
    joinedAt = toIso(data.createdAt)
    if (isBootstrapAdmin && existingRole !== 'admin') {
      try {
        await updateDoc(userRef, {
          role: 'admin',
          updatedAt: serverTimestamp(),
        })
        existingRole = 'admin'
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, userPath)
      }
    }
  }

  if (isBootstrapAdmin) {
    const adminRef = doc(db, 'admins', uid)
    let adminSnap: Awaited<ReturnType<typeof getDoc>>
    try {
      adminSnap = await getDoc(adminRef)
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `admins/${uid}`)
    }
    if (!adminSnap.exists()) {
      try {
        await setDoc(adminRef, {
          uid,
          email: (fbUser.email ?? BOOTSTRAPPED_ADMIN_EMAIL).toLowerCase(),
          createdAt: serverTimestamp(),
        })
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `admins/${uid}`)
      }
    }
  }

  const profileRef = doc(db, 'users', uid, 'private', 'profile')
  let email = fbUser.email ?? ''
  let phone = ''
  let location = 'India'
  let organisation: string | undefined
  let specialisation: string | undefined

  let profSnap: Awaited<ReturnType<typeof getDoc>>
  try {
    profSnap = await getDoc(profileRef)
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, profilePath)
  }
  if (!profSnap.exists()) {
    try {
      await setDoc(profileRef, {
        uid,
        email: email || `${uid}@users.krishi360.local`,
        location,
        phone: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, profilePath)
    }
  } else {
    const p = profSnap.data() as Record<string, unknown>
    email = (p.email as string) || email
    phone = (p.phone as string) || ''
    location = (p.location as string) || 'India'
    organisation = typeof p.organisation === 'string' ? p.organisation : undefined
    specialisation = typeof p.specialisation === 'string' ? p.specialisation : undefined
  }

  const wsRef = doc(db, 'users', uid, 'workspace', 'state')
  let wsSnap: Awaited<ReturnType<typeof getDoc>>
  try {
    wsSnap = await getDoc(wsRef)
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, workspacePath)
  }
  if (!wsSnap.exists()) {
    try {
      await setDoc(wsRef, {
        ownerId: uid,
        savedSchemeIds: [],
        applications: [],
        mandiAlerts: [],
        irrigationSchedules: [],
        customCrops: [],
        preferences: {
          language: 'English',
          notificationsEnabled: true,
          compactTables: false,
          expertReviewSlaHours: 24,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, workspacePath)
    }
  }

  return {
    id: uid,
    name: existingDisplayName,
    email,
    role: existingRole,
    location,
    phone,
    status: 'active',
    joinedAt,
    avatar: fbUser.photoURL || '',
    organisation,
    specialisation,
  }
}

export async function updateFirebaseProfile(
  uid: string,
  patch: {
    name?: string
    location?: string
    phone?: string
    organisation?: string
    specialisation?: string
  },
): Promise<void> {
  if (patch.name?.trim()) {
    const userPath = `users/${uid}`
    try {
      await updateDoc(doc(db, 'users', uid), {
        displayName: patch.name.trim().slice(0, 120),
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath)
    }
  }

  const profilePatch = stripUndefined({
    location: patch.location !== undefined ? patch.location.trim().slice(0, 160) || 'India' : undefined,
    phone: patch.phone !== undefined ? patch.phone.trim().slice(0, 32) : undefined,
    organisation: patch.organisation !== undefined ? patch.organisation.trim().slice(0, 160) : undefined,
    specialisation: patch.specialisation !== undefined ? patch.specialisation.trim().slice(0, 160) : undefined,
    updatedAt: serverTimestamp(),
  })

  if (Object.keys(profilePatch).length > 1) {
    const profilePath = `users/${uid}/private/profile`
    try {
      await updateDoc(doc(db, 'users', uid, 'private', 'profile'), profilePatch)
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, profilePath)
    }
  }
}

export interface FirebaseSnapshot {
  farms: BackendFarm[]
  soilReadings: BackendSoilReading[]
  storageBatches: StorageBatch[]
  cases: CropCase[]
  savedSchemeIds: string[]
  applications: SchemeApplication[]
  mandiAlerts: MandiAlert[]
  irrigationSchedules: IrrigationSchedule[]
  customCrops: string[]
  preferences: Partial<PlatformSettings>
  notifications: NotificationItem[]
}

export async function fetchUserFirestoreSnapshot(uid: string): Promise<FirebaseSnapshot> {
  const farmsPath = `users/${uid}/farms`
  const readingsPath = `users/${uid}/soilReadings`
  const storagePath = `users/${uid}/storageBatches`
  const casesPath = `users/${uid}/cropCases`
  const wsPath = `users/${uid}/workspace/state`
  const notifPath = `users/${uid}/notifications`

  let farms: BackendFarm[] = []
  try {
    const snap = await getDocs(
      query(collection(db, farmsPath), where('ownerId', '==', uid), limit(20)),
    )
    const farmRows = snap.docs.map((d) => {
      const data = d.data()
      return {
        updatedMs: toIso(data.updatedAt),
        farm: {
          id: d.id,
          farmerId: uid,
          name: String(data.name ?? ''),
          location: String(data.location ?? ''),
          areaHa: Number(data.areaHa ?? 0),
          soilType: String(data.soilType ?? ''),
          irrigationType: String(data.irrigationType ?? ''),
          centerLat: typeof data.centerLat === 'number' ? data.centerLat : undefined,
          centerLng: typeof data.centerLng === 'number' ? data.centerLng : undefined,
          plots: Array.isArray(data.plots) ? (data.plots as BackendFarm['plots']) : [],
        } satisfies BackendFarm,
      }
    })
    farmRows.sort((a, b) => b.updatedMs.localeCompare(a.updatedMs))
    farms = farmRows.map((r) => r.farm)
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, farmsPath)
  }

  let soilReadings: BackendSoilReading[] = []
  try {
    const snap = await getDocs(
      query(collection(db, readingsPath), where('ownerId', '==', uid), limit(50)),
    )
    soilReadings = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        farmId: String(data.farmId ?? ''),
        plotId: String(data.plotId ?? ''),
        soilMoisture: Number(data.soilMoisture ?? 0),
        source: (data.source as 'manual' | 'simulated') ?? 'manual',
        weather: data.weather as BackendSoilReading['weather'],
        notes: typeof data.notes === 'string' ? data.notes : undefined,
        recommendation: data.recommendation as IrrigationRecommendation,
        recordedBy: uid,
        createdAt: toIso(data.createdAt),
      }
    })
    soilReadings.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, readingsPath)
  }

  let storageBatches: StorageBatch[] = []
  try {
    const snap = await getDocs(
      query(collection(db, storagePath), where('ownerId', '==', uid), limit(50)),
    )
    storageBatches = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        code: String(data.code ?? d.id),
        crop: String(data.crop ?? ''),
        quantityKg: Number(data.quantityKg ?? 0),
        location: String(data.location ?? ''),
        tempC: Number(data.tempC ?? 0),
        humidity: Number(data.humidity ?? 0),
        minTemp: Number(data.minTemp ?? 0),
        maxTemp: Number(data.maxTemp ?? 30),
        maxHumidity: Number(data.maxHumidity ?? 70),
        status: (data.status as StorageStatus) ?? 'normal',
        createdAt: toIso(data.createdAt),
        inspections: Array.isArray(data.inspections)
          ? (data.inspections as StorageBatch['inspections'])
          : [],
      }
    })
    storageBatches.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, storagePath)
  }

  let cases: CropCase[] = []
  try {
    const snap = await getDocs(
      query(collection(db, casesPath), where('ownerId', '==', uid), limit(50)),
    )
    cases = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        farmerId: uid,
        farmerName: String(data.farmerName ?? 'Farmer'),
        crop: String(data.crop ?? ''),
        plantPart: String(data.plantPart ?? ''),
        location: String(data.location ?? ''),
        symptoms: String(data.symptoms ?? ''),
        imageUrl: String(data.imageUrl ?? '/sample-leaf.svg'),
        condition: String(data.condition ?? ''),
        confidence: Number(data.confidence ?? 0),
        alternatives: Array.isArray(data.alternatives)
          ? (data.alternatives as CropCase['alternatives'])
          : [],
        observedSymptoms: Array.isArray(data.observedSymptoms)
          ? (data.observedSymptoms as string[])
          : [],
        explanation: String(data.explanation ?? ''),
        nextSteps: Array.isArray(data.nextSteps) ? (data.nextSteps as string[]) : [],
        recommendExpert: Boolean(data.recommendExpert ?? true),
        provider: data.provider as CropCase['provider'],
        modelId: typeof data.modelId === 'string' ? data.modelId : undefined,
        uncertainty: typeof data.uncertainty === 'string' ? data.uncertainty : undefined,
        simulated: typeof data.simulated === 'boolean' ? data.simulated : undefined,
        status: (data.status as CropCase['status']) ?? 'ai_review',
        priority: (data.priority as CropCase['priority']) ?? 'medium',
        submittedAt: toIso(data.createdAt),
        reviewStatus: (data.reviewStatus as CropCase['reviewStatus']) ?? 'pending',
        expertNotes: typeof data.expertNotes === 'string' ? data.expertNotes : undefined,
        expertGuidance: typeof data.expertGuidance === 'string' ? data.expertGuidance : undefined,
        reviewedAt: typeof data.reviewedAt === 'string' ? data.reviewedAt : undefined,
        reviewedBy: typeof data.reviewedBy === 'string' ? data.reviewedBy : undefined,
      }
    })
    cases.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, casesPath)
  }

  let savedSchemeIds: string[] = []
  let applications: SchemeApplication[] = []
  let mandiAlerts: MandiAlert[] = []
  let irrigationSchedules: IrrigationSchedule[] = []
  let customCrops: string[] = []
  let preferences: Partial<PlatformSettings> = {}

  try {
    const wsSnap = await getDoc(doc(db, wsPath))
    if (wsSnap.exists()) {
      const w = wsSnap.data()
      savedSchemeIds = Array.isArray(w.savedSchemeIds) ? (w.savedSchemeIds as string[]) : []
      applications = Array.isArray(w.applications) ? (w.applications as SchemeApplication[]) : []
      mandiAlerts = Array.isArray(w.mandiAlerts) ? (w.mandiAlerts as MandiAlert[]) : []
      irrigationSchedules = Array.isArray(w.irrigationSchedules)
        ? (w.irrigationSchedules as IrrigationSchedule[])
        : []
      customCrops = Array.isArray(w.customCrops) ? (w.customCrops as string[]) : []
      if (w.preferences && typeof w.preferences === 'object') {
        preferences = w.preferences as Partial<PlatformSettings>
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, wsPath)
  }

  let notifications: NotificationItem[] = []
  try {
    const snap = await getDocs(
      query(collection(db, notifPath), where('ownerId', '==', uid), limit(50)),
    )
    notifications = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        title: String(data.title ?? ''),
        body: String(data.body ?? ''),
        severity: (data.severity as Severity) ?? 'info',
        createdAt: toIso(data.createdAt),
        read: Boolean(data.read),
        audience: (data.audience as Role | 'all') ?? 'all',
      }
    })
    notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, notifPath)
  }

  return {
    farms,
    soilReadings,
    storageBatches,
    cases,
    savedSchemeIds,
    applications,
    mandiAlerts,
    irrigationSchedules,
    customCrops,
    preferences,
    notifications,
  }
}

export async function createFirebaseFarm(
  uid: string,
  input: {
    name: string
    location: string
    areaHa: number
    soilType: string
    irrigationType: string
    plots: BackendFarm['plots']
    centerLat?: number
    centerLng?: number
  },
): Promise<BackendFarm> {
  const farmId = safeId('FARM')
  const path = `users/${uid}/farms/${farmId}`
  const safeName = input.name.trim().slice(0, 120) || 'My Farm'
  const safeLocation = input.location.trim().slice(0, 160) || 'India'
  const safeSoil = input.soilType.trim().slice(0, 80) || 'Black cotton'
  const safeIrrigation = input.irrigationType.trim().slice(0, 80) || 'Drip irrigation'
  const cleanPlots = (input.plots ?? []).slice(0, 50).map((p) => stripUndefined({ ...p }))
  try {
    await setDoc(
      doc(db, 'users', uid, 'farms', farmId),
      stripUndefined({
        ownerId: uid,
        name: safeName,
        location: safeLocation,
        areaHa: Number(input.areaHa ?? 0),
        soilType: safeSoil,
        irrigationType: safeIrrigation,
        plots: cleanPlots,
        centerLat: input.centerLat,
        centerLng: input.centerLng,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
    return {
      id: farmId,
      farmerId: uid,
      name: safeName,
      location: safeLocation,
      areaHa: Number(input.areaHa ?? 0),
      soilType: safeSoil,
      irrigationType: safeIrrigation,
      plots: input.plots ?? [],
      centerLat: input.centerLat,
      centerLng: input.centerLng,
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path)
  }
}

export async function updateFirebaseFarm(
  uid: string,
  farmId: string,
  patch: {
    name?: string
    location?: string
    areaHa?: number
    soilType?: string
    irrigationType?: string
    centerLat?: number
    centerLng?: number
    plots?: BackendFarm['plots']
  },
): Promise<void> {
  const path = `users/${uid}/farms/${farmId}`
  try {
    if (patch.plots !== undefined) {
      const cleanPlots = patch.plots.slice(0, 50).map((p) => stripUndefined({ ...p }))
      const totalArea = Number(
        cleanPlots.reduce((sum, p) => sum + Number((p as { areaHa?: number }).areaHa ?? 0), 0).toFixed(2),
      )
      await updateDoc(doc(db, 'users', uid, 'farms', farmId), {
        plots: cleanPlots,
        areaHa: totalArea,
        updatedAt: serverTimestamp(),
      })
    } else {
      await updateDoc(
        doc(db, 'users', uid, 'farms', farmId),
        stripUndefined({
          name: patch.name?.trim().slice(0, 120),
          location: patch.location?.trim().slice(0, 160),
          areaHa: patch.areaHa,
          soilType: patch.soilType?.trim().slice(0, 80),
          irrigationType: patch.irrigationType?.trim().slice(0, 80),
          centerLat: patch.centerLat,
          centerLng: patch.centerLng,
          updatedAt: serverTimestamp(),
        }),
      )
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path)
  }
}

export async function logFirebaseSoilReading(
  uid: string,
  farmId: string,
  input: {
    plotId: string
    soilMoisture: number
    source: 'manual' | 'simulated'
    weather?: { condition: string; temperatureC?: number; rainfallMm?: number }
    notes?: string
  },
  recommendation: IrrigationRecommendation,
): Promise<BackendSoilReading> {
  const readingId = safeId('READ')
  const path = `users/${uid}/soilReadings/${readingId}`
  try {
    await setDoc(
      doc(db, 'users', uid, 'soilReadings', readingId),
      stripUndefined({
        ownerId: uid,
        farmId,
        plotId: input.plotId,
        soilMoisture: input.soilMoisture,
        source: input.source,
        weather: input.weather ? stripUndefined({ ...input.weather }) : undefined,
        notes: input.notes?.trim().slice(0, 1000) || undefined,
        recommendation: stripUndefined({ ...recommendation }),
        createdAt: serverTimestamp(),
      }),
    )
    return {
      id: readingId,
      farmId,
      plotId: input.plotId,
      soilMoisture: input.soilMoisture,
      source: input.source,
      weather: input.weather,
      notes: input.notes,
      recommendation,
      recordedBy: uid,
      createdAt: new Date().toISOString(),
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path)
  }
}

export async function createFirebaseStorageBatch(
  uid: string,
  batch: StorageBatch,
): Promise<StorageBatch> {
  const batchId = safeId('BATCH')
  const path = `users/${uid}/storageBatches/${batchId}`
  try {
    await setDoc(doc(db, 'users', uid, 'storageBatches', batchId), {
      ownerId: uid,
      code: batch.code.slice(0, 64),
      crop: batch.crop.slice(0, 80),
      quantityKg: batch.quantityKg,
      location: batch.location.slice(0, 160),
      tempC: batch.tempC,
      humidity: batch.humidity,
      minTemp: batch.minTemp,
      maxTemp: batch.maxTemp,
      maxHumidity: batch.maxHumidity,
      status: batch.status,
      inspections: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return {
      ...batch,
      id: batchId,
      createdAt: new Date().toISOString(),
      inspections: [],
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path)
  }
}

export async function updateFirebaseStorageBatchReading(
  uid: string,
  batchId: string,
  tempC: number,
  humidity: number,
  status: StorageStatus,
): Promise<void> {
  const path = `users/${uid}/storageBatches/${batchId}`
  try {
    await updateDoc(doc(db, 'users', uid, 'storageBatches', batchId), {
      tempC,
      humidity,
      status,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path)
  }
}

export async function updateFirebaseStorageInspections(
  uid: string,
  batchId: string,
  inspections: StorageBatch['inspections'],
): Promise<void> {
  const path = `users/${uid}/storageBatches/${batchId}`
  try {
    await updateDoc(doc(db, 'users', uid, 'storageBatches', batchId), {
      inspections: inspections.slice(0, 50).map((i) => stripUndefined({ ...i })),
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path)
  }
}

export async function createFirebaseCropCase(uid: string, cropCase: CropCase): Promise<CropCase> {
  const caseId = cropCase.id && /^[a-zA-Z0-9_-]{1,128}$/.test(cropCase.id) ? cropCase.id : safeId('CASE')
  const path = `users/${uid}/cropCases/${caseId}`
  try {
    await setDoc(
      doc(db, 'users', uid, 'cropCases', caseId),
      stripUndefined({
        ownerId: uid,
        farmerName: (cropCase.farmerName || 'Farmer').slice(0, 120),
        crop: cropCase.crop.slice(0, 80),
        plantPart: cropCase.plantPart.slice(0, 80),
        location: cropCase.location.slice(0, 160),
        symptoms: (cropCase.symptoms || '').slice(0, 1500),
        imageUrl: (cropCase.imageUrl || '/sample-leaf.svg').slice(0, 512),
        condition: (cropCase.condition || 'Possible plant stress').slice(0, 200),
        confidence: cropCase.confidence,
        alternatives: (cropCase.alternatives ?? []).slice(0, 5).map((a) => stripUndefined({ ...a })),
        observedSymptoms: (cropCase.observedSymptoms ?? []).slice(0, 15).map((s) => String(s).slice(0, 200)),
        explanation: (cropCase.explanation || '').slice(0, 2500),
        nextSteps: (cropCase.nextSteps ?? []).slice(0, 10).map((s) => String(s).slice(0, 300)),
        recommendExpert: Boolean(cropCase.recommendExpert),
        provider: cropCase.provider,
        modelId: cropCase.modelId?.slice(0, 120),
        uncertainty: cropCase.uncertainty?.slice(0, 1000),
        simulated: cropCase.simulated,
        status: cropCase.status,
        priority: cropCase.priority,
        reviewStatus: cropCase.reviewStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
    return { ...cropCase, id: caseId, farmerId: uid }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path)
  }
}

export async function updateFirebaseWorkspaceField(
  uid: string,
  field:
    | 'savedSchemeIds'
    | 'applications'
    | 'mandiAlerts'
    | 'irrigationSchedules'
    | 'customCrops'
    | 'preferences',
  value: unknown,
): Promise<void> {
  const path = `users/${uid}/workspace/state`
  try {
    await updateDoc(doc(db, 'users', uid, 'workspace', 'state'), {
      [field]: value,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path)
  }
}

export async function createFirebaseNotification(
  uid: string,
  input: { title: string; body: string; severity: Severity; audience: Role | 'all' },
): Promise<NotificationItem> {
  const id = safeId('NOTIF')
  const path = `users/${uid}/notifications/${id}`
  try {
    await setDoc(doc(db, 'users', uid, 'notifications', id), {
      ownerId: uid,
      title: input.title.slice(0, 160),
      body: input.body.slice(0, 1000),
      severity: input.severity,
      audience: input.audience,
      read: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return {
      id,
      ...input,
      read: false,
      createdAt: new Date().toISOString(),
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path)
  }
}

export async function markFirebaseNotificationRead(uid: string, id: string): Promise<void> {
  const path = `users/${uid}/notifications/${id}`
  try {
    await updateDoc(doc(db, 'users', uid, 'notifications', id), {
      read: true,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path)
  }
}

export async function listFirebaseCopilotSessions(uid: string): Promise<CopilotSessionRecord[]> {
  const path = `users/${uid}/copilotSessions`
  try {
    const snap = await getDocs(
      query(collection(db, path), where('ownerId', '==', uid), limit(20)),
    )
    const sessions = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        title: String(data.title ?? 'Krishi Copilot Chat'),
        mode: (data.mode === 'fast' ? 'fast' : 'grounded') as 'grounded' | 'fast',
        messages: Array.isArray(data.messages) ? (data.messages as CopilotSessionRecord['messages']) : [],
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
      }
    })
    sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return sessions
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path)
  }
}

export async function saveFirebaseCopilotSession(
  uid: string,
  session: {
    id?: string
    title: string
    mode: 'grounded' | 'fast'
    messages: CopilotSessionRecord['messages']
  },
): Promise<CopilotSessionRecord> {
  const sessionId = session.id && /^[a-zA-Z0-9_-]{1,128}$/.test(session.id) ? session.id : safeId('CHAT')
  const path = `users/${uid}/copilotSessions/${sessionId}`
  const cleanMessages = session.messages.slice(-100).map((m) =>
    stripUndefined({
      id: m.id,
      sender: m.sender,
      text: m.text.slice(0, 4000),
      time: m.time,
      modelUsed: m.modelUsed,
      groundingSources: m.groundingSources?.slice(0, 8),
      safetyFiltered: m.safetyFiltered,
    }),
  )
  try {
    const ref = doc(db, 'users', uid, 'copilotSessions', sessionId)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: uid,
        title: session.title.slice(0, 160),
        mode: session.mode,
        messages: cleanMessages,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } else {
      await updateDoc(ref, {
        title: session.title.slice(0, 160),
        mode: session.mode,
        messages: cleanMessages,
        updatedAt: serverTimestamp(),
      })
    }
    return {
      id: sessionId,
      title: session.title.slice(0, 160),
      mode: session.mode,
      messages: session.messages.slice(-100),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path)
  }
}

export async function deleteFirebaseCopilotSession(uid: string, sessionId: string): Promise<void> {
  const path = `users/${uid}/copilotSessions/${sessionId}`
  try {
    await deleteDoc(doc(db, 'users', uid, 'copilotSessions', sessionId))
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path)
  }
}
