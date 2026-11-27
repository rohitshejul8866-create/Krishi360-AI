import type { User as FirebaseUser } from 'firebase/auth'
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import firebaseConfig from '../../../firebase-applet-config.json'
import { DEMO_MANDI_PRICES } from '../data/mandiPrices'
import { DEMO_SCHEMES } from '../data/schemes'
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase'
import type {
  AuditLog,
  CropCase,
  DemoUser,
  GroundingSource,
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
import type { BackendFarm, BackendSoilReading } from './apiMappers'
import type { BackendEntityName, BackendStatusSnapshot } from './backendService'

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
          status: 'active',
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
    const nextPhotoUrl = fbUser.photoURL ? fbUser.photoURL.slice(0, 512) : undefined
    const needsRoleUpgrade = isBootstrapAdmin && existingRole !== 'admin'
    const needsPhotoSync = Boolean(nextPhotoUrl && nextPhotoUrl !== data.photoUrl)
    if (needsRoleUpgrade || needsPhotoSync) {
      try {
        await updateDoc(
          userRef,
          stripUndefined({
            role: needsRoleUpgrade ? 'admin' : undefined,
            photoUrl: needsPhotoSync ? nextPhotoUrl : undefined,
            updatedAt: serverTimestamp(),
          }),
        )
        if (needsRoleUpgrade) existingRole = 'admin'
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
  const userPath = `users/${uid}`
  const userRef = doc(db, 'users', uid)
  try {
    const userSnap = await getDoc(userRef)
    if (!userSnap.exists()) {
      const fbUser = auth.currentUser
      const isBootstrapAdmin =
        Boolean(fbUser?.emailVerified) && fbUser?.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
      await setDoc(
        userRef,
        stripUndefined({
          uid,
          displayName: (patch.name?.trim() || fbUser?.displayName?.trim() || fbUser?.email?.split('@')[0] || 'Farmer').slice(0, 120),
          role: isBootstrapAdmin ? 'admin' : 'farmer',
          status: 'active',
          photoUrl: fbUser?.photoURL ? fbUser.photoURL.slice(0, 512) : undefined,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      )
    } else if (patch.name?.trim()) {
      await updateDoc(userRef, {
        displayName: patch.name.trim().slice(0, 120),
        updatedAt: serverTimestamp(),
      })
    } else if (
      patch.location !== undefined ||
      patch.phone !== undefined ||
      patch.organisation !== undefined ||
      patch.specialisation !== undefined
    ) {
      await updateDoc(userRef, {
        updatedAt: serverTimestamp(),
      })
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath)
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
    const profileRef = doc(db, 'users', uid, 'private', 'profile')
    try {
      const profSnap = await getDoc(profileRef)
      if (!profSnap.exists()) {
        await setDoc(
          profileRef,
          stripUndefined({
            uid,
            email: auth.currentUser?.email || `${uid}@users.krishi360.local`,
            location: 'India',
            phone: '',
            ...profilePatch,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
        )
      } else {
        await updateDoc(profileRef, profilePatch)
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, profilePath)
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
        ownerId: String(data.ownerId ?? uid),
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
        ownerId: String(data.ownerId ?? uid),
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
      ownerId: uid,
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
  const wsRef = doc(db, 'users', uid, 'workspace', 'state')
  let cleanValue = value
  if (field === 'preferences' && value && typeof value === 'object') {
    const p = value as Record<string, unknown>
    cleanValue = stripUndefined({
      language: typeof p.language === 'string' ? p.language.slice(0, 40) : undefined,
      notificationsEnabled: typeof p.notificationsEnabled === 'boolean' ? p.notificationsEnabled : undefined,
      compactTables: typeof p.compactTables === 'boolean' ? p.compactTables : undefined,
      expertReviewSlaHours:
        typeof p.expertReviewSlaHours === 'number'
          ? Math.max(1, Math.min(168, p.expertReviewSlaHours))
          : undefined,
    })
  }
  try {
    const snap = await getDoc(wsRef)
    if (!snap.exists()) {
      const defaults: Record<string, unknown> = {
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
      }
      defaults[field] = cleanValue
      await setDoc(wsRef, defaults)
      return
    }
    await updateDoc(wsRef, {
      [field]: cleanValue,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path)
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
      ownerId: uid,
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

export async function listFirestoreMandiPrices(): Promise<MandiPrice[]> {
  const path = 'mandiPrices'
  try {
    const snap = await getDocs(
      query(collection(db, path), where('dataType', 'in', ['sample', 'verified']), limit(100)),
    )
    const rows = snap.docs.map((d) => {
      const data = d.data()
      return {
        createdAtMs: toIso(data.createdAt),
        price: {
          id: d.id,
          crop: String(data.crop ?? ''),
          state: String(data.state ?? ''),
          district: String(data.district ?? ''),
          mandi: String(data.mandi ?? ''),
          minPrice: Number(data.minPrice ?? 0),
          maxPrice: Number(data.maxPrice ?? 0),
          modalPrice: Number(data.modalPrice ?? 0),
          changePct: Number(data.changePct ?? 0),
          date: String(data.date ?? ''),
          source: String(data.source ?? 'Firestore catalogue'),
        } satisfies MandiPrice,
      }
    })
    rows.sort((a, b) => b.createdAtMs.localeCompare(a.createdAtMs))
    return rows.map((r) => r.price)
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path)
  }
}

export async function createFirebaseMandiPrice(
  uid: string,
  input: {
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
  },
): Promise<MandiPrice> {
  const id = safeId('MANDI')
  const path = `mandiPrices/${id}`
  const payload = stripUndefined({
    createdBy: uid,
    crop: input.crop.trim().slice(0, 80) || 'Tomato',
    state: input.state.trim().slice(0, 80) || 'Maharashtra',
    district: input.district.trim().slice(0, 80) || 'Nashik',
    mandi: input.mandi.trim().slice(0, 120) || 'APMC Mandi',
    minPrice: Math.max(0, Math.min(1000000, Number(input.minPrice ?? 0))),
    maxPrice: Math.max(0, Math.min(1000000, Number(input.maxPrice ?? 0))),
    modalPrice: Math.max(0, Math.min(1000000, Number(input.modalPrice ?? 0))),
    changePct: Math.max(-100, Math.min(1000, Number(input.changePct ?? 0))),
    date: input.date.trim().slice(0, 32) || new Date().toISOString().slice(0, 10),
    source: (input.source || 'Admin portal entry').trim().slice(0, 160),
    dataType: input.dataType === 'verified' ? 'verified' : 'sample',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  try {
    await setDoc(doc(db, 'mandiPrices', id), payload)
    return {
      id,
      crop: String(payload.crop),
      state: String(payload.state),
      district: String(payload.district),
      mandi: String(payload.mandi),
      minPrice: Number(payload.minPrice),
      maxPrice: Number(payload.maxPrice),
      modalPrice: Number(payload.modalPrice),
      changePct: Number(payload.changePct),
      date: String(payload.date),
      source: String(payload.source),
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path)
  }
}

export async function listFirestoreSchemes(): Promise<Scheme[]> {
  const path = 'schemes'
  try {
    const snap = await getDocs(
      query(collection(db, path), where('dataType', 'in', ['sample', 'verified']), limit(100)),
    )
    const rows = snap.docs.map((d) => {
      const data = d.data()
      return {
        createdAtMs: toIso(data.createdAt),
        scheme: {
          id: d.id,
          name: String(data.name ?? ''),
          category: String(data.category ?? ''),
          state: String(data.state ?? ''),
          summary: String(data.summary ?? ''),
          eligibility: Array.isArray(data.eligibility) ? (data.eligibility as string[]) : [],
          documents: Array.isArray(data.documents) ? (data.documents as string[]) : [],
          sourceLabel: String(data.sourceLabel ?? ''),
          sourceUrl: String(data.sourceUrl ?? ''),
          tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
        } satisfies Scheme,
      }
    })
    rows.sort((a, b) => b.createdAtMs.localeCompare(a.createdAtMs))
    return rows.map((r) => r.scheme)
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path)
  }
}

export async function createFirebaseScheme(
  uid: string,
  input: {
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
  },
): Promise<Scheme> {
  const id = input.id && /^[a-zA-Z0-9_-]{1,128}$/.test(input.id) ? input.id : safeId('SCHM')
  const path = `schemes/${id}`
  const payload = {
    createdBy: uid,
    name: input.name.trim().slice(0, 160),
    category: input.category.trim().slice(0, 80) || 'General',
    state: input.state.trim().slice(0, 80) || 'All India',
    summary: input.summary.trim().slice(0, 2000),
    eligibility: input.eligibility.slice(0, 25).map((s) => s.trim().slice(0, 300)).filter(Boolean),
    documents: input.documents.slice(0, 25).map((s) => s.trim().slice(0, 200)).filter(Boolean),
    sourceLabel: (input.sourceLabel || 'Official portal').trim().slice(0, 160),
    sourceUrl: (input.sourceUrl || 'https://www.india.gov.in/').trim().slice(0, 512),
    tags: input.tags.slice(0, 20).map((s) => s.trim().slice(0, 64)).filter(Boolean),
    dataType: input.dataType === 'verified' ? ('verified' as const) : ('sample' as const),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  try {
    await setDoc(doc(db, 'schemes', id), payload)
    return {
      id,
      name: payload.name,
      category: payload.category,
      state: payload.state,
      summary: payload.summary,
      eligibility: payload.eligibility,
      documents: payload.documents,
      sourceLabel: payload.sourceLabel,
      sourceUrl: payload.sourceUrl,
      tags: payload.tags,
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path)
  }
}

export async function getFirebasePlatformSettings(): Promise<PlatformSettings | null> {
  const path = 'platform/settings'
  try {
    const snap = await getDoc(doc(db, 'platform', 'settings'))
    if (!snap.exists()) return null
    const data = snap.data()
    return {
      language: String(data.language ?? 'English'),
      notificationsEnabled: Boolean(data.notificationsEnabled ?? true),
      demoMode: Boolean(data.demoMode ?? true),
      compactTables: Boolean(data.compactTables ?? false),
      expertReviewSlaHours: Number(data.expertReviewSlaHours ?? 24),
      storageAlertTemp: Number(data.storageAlertTemp ?? 28),
      storageAlertHumidity: Number(data.storageAlertHumidity ?? 70),
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path)
  }
}

export async function saveFirebasePlatformSettings(
  uid: string,
  settings: PlatformSettings,
): Promise<PlatformSettings> {
  const path = 'platform/settings'
  const ref = doc(db, 'platform', 'settings')
  const sanitized = {
    language: (settings.language || 'English').slice(0, 40),
    notificationsEnabled: Boolean(settings.notificationsEnabled),
    demoMode: Boolean(settings.demoMode),
    compactTables: Boolean(settings.compactTables),
    expertReviewSlaHours: Math.max(1, Math.min(168, Number(settings.expertReviewSlaHours ?? 24))),
    storageAlertTemp: Math.max(-10, Math.min(60, Number(settings.storageAlertTemp ?? 28))),
    storageAlertHumidity: Math.max(0, Math.min(100, Number(settings.storageAlertHumidity ?? 70))),
    updatedBy: uid.slice(0, 128),
  }
  try {
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } else {
      await updateDoc(ref, {
        ...sanitized,
        updatedAt: serverTimestamp(),
      })
    }
    return {
      language: sanitized.language,
      notificationsEnabled: sanitized.notificationsEnabled,
      demoMode: sanitized.demoMode,
      compactTables: sanitized.compactTables,
      expertReviewSlaHours: sanitized.expertReviewSlaHours,
      storageAlertTemp: sanitized.storageAlertTemp,
      storageAlertHumidity: sanitized.storageAlertHumidity,
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path)
  }
}

export async function createFirebaseAuditLog(
  uid: string,
  entry: { actor: string; role: Role; action: string; target: string },
): Promise<AuditLog> {
  const id = safeId('LOG')
  const path = `auditLogs/${id}`
  const payload = {
    actorUid: uid,
    actor: (entry.actor || 'User').slice(0, 120),
    role: entry.role,
    action: (entry.action || 'Action').slice(0, 200),
    target: (entry.target || 'System').slice(0, 160),
    createdAt: serverTimestamp(),
  }
  try {
    await setDoc(doc(db, 'auditLogs', id), payload)
    return {
      id,
      actor: payload.actor,
      role: payload.role,
      action: payload.action,
      target: payload.target,
      timestamp: new Date().toISOString(),
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path)
  }
}

export async function listFirestoreAuditLogs(uid: string, isAdmin: boolean): Promise<AuditLog[]> {
  const path = 'auditLogs'
  try {
    const q = isAdmin
      ? query(collection(db, path), limit(100))
      : query(collection(db, path), where('actorUid', '==', uid), limit(50))
    const snap = await getDocs(q)
    const logs = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        actor: String(data.actor ?? 'User'),
        role: (data.role as Role) ?? 'farmer',
        action: String(data.action ?? ''),
        target: String(data.target ?? ''),
        timestamp: toIso(data.createdAt),
      } satisfies AuditLog
    })
    logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    return logs
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path)
  }
}

export async function listFirestoreUsersForAdmin(): Promise<DemoUser[]> {
  const path = 'users'
  try {
    const snap = await getDocs(query(collection(db, path), limit(100)))
    const users = await Promise.all(
      snap.docs.map(async (userDoc) => {
        const data = userDoc.data()
        let email = ''
        let phone = ''
        let location = 'India'
        let organisation: string | undefined
        let specialisation: string | undefined
        try {
          const profSnap = await getDoc(doc(db, 'users', userDoc.id, 'private', 'profile'))
          if (profSnap.exists()) {
            const p = profSnap.data()
            email = String(p.email ?? '')
            phone = String(p.phone ?? '')
            location = String(p.location ?? 'India')
            organisation = typeof p.organisation === 'string' ? p.organisation : undefined
            specialisation = typeof p.specialisation === 'string' ? p.specialisation : undefined
          }
        } catch {
          // Non-fatal fallback if profile subdoc is absent
        }
        return {
          id: userDoc.id,
          name: String(data.displayName ?? 'User'),
          email: email || `${userDoc.id}@users.krishi360.local`,
          role: (data.role as Role) ?? 'farmer',
          location,
          phone,
          status: (data.status as UserStatus) ?? 'active',
          joinedAt: toIso(data.createdAt),
          avatar: typeof data.photoUrl === 'string' ? data.photoUrl : '',
          organisation,
          specialisation,
        } satisfies DemoUser
      }),
    )
    users.sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    return users
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path)
  }
}

export async function createFirebaseDirectoryUser(input: {
  name: string
  email: string
  role: Role
  location: string
  phone: string
  specialisation?: string
}): Promise<DemoUser> {
  const userId = safeId('USR')
  const userPath = `users/${userId}`
  const profilePath = `users/${userId}/private/profile`
  const displayName = input.name.trim().slice(0, 120)
  const email = input.email.trim().toLowerCase().slice(0, 254)
  const location = input.location.trim().slice(0, 160) || 'India'
  const phone = input.phone.trim().slice(0, 32)
  const specialisation = input.specialisation?.trim().slice(0, 160) || undefined
  const status: UserStatus = 'invited'

  try {
    await setDoc(doc(db, 'users', userId), {
      uid: userId,
      displayName,
      role: input.role,
      status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, userPath)
  }

  try {
    await setDoc(
      doc(db, 'users', userId, 'private', 'profile'),
      stripUndefined({
        uid: userId,
        email,
        location,
        phone,
        specialisation,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, profilePath)
  }

  return {
    id: userId,
    name: displayName,
    email,
    role: input.role,
    location,
    phone,
    status,
    joinedAt: new Date().toISOString(),
    avatar: '',
    specialisation,
  }
}

export async function updateFirebaseUserStatus(userId: string, status: UserStatus): Promise<void> {
  const path = `users/${userId}`
  try {
    await updateDoc(doc(db, 'users', userId), {
      status,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path)
  }
}

function mapFirestoreCropCaseDoc(id: string, data: Record<string, unknown>): CropCase {
  return {
    id,
    farmerId: String(data.ownerId ?? ''),
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
}

function mapFirestoreFarmDoc(id: string, fallbackOwnerId: string, data: Record<string, unknown>): { updatedMs: string; farm: BackendFarm } {
  const ownerId = String(data.ownerId ?? fallbackOwnerId)
  return {
    updatedMs: toIso(data.updatedAt),
    farm: {
      id,
      farmerId: ownerId,
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
}

function mapFirestoreStorageBatchDoc(id: string, fallbackOwnerId: string, data: Record<string, unknown>): StorageBatch {
  return {
    id,
    ownerId: String(data.ownerId ?? fallbackOwnerId),
    code: String(data.code ?? id),
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
}

function mapFirestoreNotificationDoc(id: string, fallbackOwnerId: string, data: Record<string, unknown>): NotificationItem {
  return {
    id,
    ownerId: String(data.ownerId ?? fallbackOwnerId),
    title: String(data.title ?? ''),
    body: String(data.body ?? ''),
    severity: (data.severity as Severity) ?? 'info',
    createdAt: toIso(data.createdAt),
    read: Boolean(data.read),
    audience: (data.audience as Role | 'all') ?? 'all',
  }
}

export async function listAllFirestoreCropCasesForAdmin(): Promise<CropCase[]> {
  const path = 'cropCases (collectionGroup)'
  try {
    const snap = await getDocs(query(collectionGroup(db, 'cropCases'), limit(100)))
    const rows = snap.docs.map((d) => mapFirestoreCropCaseDoc(d.id, d.data() as Record<string, unknown>))
    rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    return rows
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path)
  }
}

export async function listAllFirestoreFarmsForAdmin(): Promise<BackendFarm[]> {
  const path = 'farms (collectionGroup)'
  try {
    const snap = await getDocs(query(collectionGroup(db, 'farms'), limit(100)))
    const rows = snap.docs.map((d) =>
      mapFirestoreFarmDoc(d.id, d.ref.parent.parent?.id ?? '', d.data() as Record<string, unknown>),
    )
    rows.sort((a, b) => b.updatedMs.localeCompare(a.updatedMs))
    return rows.map((r) => r.farm)
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path)
  }
}

export async function listAllFirestoreStorageBatchesForAdmin(): Promise<StorageBatch[]> {
  const path = 'storageBatches (collectionGroup)'
  try {
    const snap = await getDocs(query(collectionGroup(db, 'storageBatches'), limit(100)))
    const rows = snap.docs.map((d) =>
      mapFirestoreStorageBatchDoc(d.id, d.ref.parent.parent?.id ?? '', d.data() as Record<string, unknown>),
    )
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return rows
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path)
  }
}

export async function listAllFirestoreNotificationsForAdmin(): Promise<NotificationItem[]> {
  const path = 'notifications (collectionGroup)'
  try {
    const snap = await getDocs(query(collectionGroup(db, 'notifications'), limit(100)))
    const rows = snap.docs.map((d) =>
      mapFirestoreNotificationDoc(d.id, d.ref.parent.parent?.id ?? '', d.data() as Record<string, unknown>),
    )
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return rows
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path)
  }
}

export function subscribeAdminFirestoreData(handlers: {
  onUsers: (users: DemoUser[]) => void
  onFarms: (farms: BackendFarm[]) => void
  onStorageBatches: (batches: StorageBatch[]) => void
  onCropCases: (cases: CropCase[]) => void
  onNotifications: (notifications: NotificationItem[]) => void
  onAuditLogs: (logs: AuditLog[]) => void
}): () => void {
  let disposed = false
  let usersVersion = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  const hydrateUsersFromDocs = async (docs: Array<{ id: string; data: () => Record<string, unknown> }>) => {
    const version = ++usersVersion
    let missingProfile = false
    const settled = await Promise.allSettled(
      docs.map(async (userDoc): Promise<DemoUser> => {
        const data = userDoc.data()
        let email = ''
        let phone = ''
        let location = 'India'
        let organisation: string | undefined
        let specialisation: string | undefined
        try {
          const profSnap = await getDoc(doc(db, 'users', userDoc.id, 'private', 'profile'))
          if (profSnap.exists()) {
            const p = profSnap.data()
            email = String(p.email ?? '')
            phone = String(p.phone ?? '')
            location = String(p.location ?? 'India')
            organisation = typeof p.organisation === 'string' ? p.organisation : undefined
            specialisation = typeof p.specialisation === 'string' ? p.specialisation : undefined
          } else {
            missingProfile = true
          }
        } catch {
          missingProfile = true
        }
        return {
          id: userDoc.id,
          name: String(data.displayName ?? 'User'),
          email: email || `${userDoc.id}@users.krishi360.local`,
          role: (data.role as Role) ?? 'farmer',
          location,
          phone,
          status: (data.status as UserStatus) ?? 'active',
          joinedAt: toIso(data.createdAt),
          avatar: typeof data.photoUrl === 'string' ? data.photoUrl : '',
          organisation,
          specialisation,
        } satisfies DemoUser
      }),
    )
    if (disposed || version !== usersVersion) return
    const users = settled
      .filter((r): r is PromiseFulfilledResult<DemoUser> => r.status === 'fulfilled')
      .map((r) => r.value)
      .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    handlers.onUsers(users)

    if (missingProfile && !retryTimer) {
      retryTimer = setTimeout(() => {
        retryTimer = null
        if (!disposed) {
          void listFirestoreUsersForAdmin()
            .then((fresh) => {
              if (!disposed) handlers.onUsers(fresh)
            })
            .catch(() => {})
        }
      }, 1200)
    }
  }

  const unsubUsers = onSnapshot(
    query(collection(db, 'users'), limit(100)),
    (snap) => {
      void hydrateUsersFromDocs(snap.docs)
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users')
    },
  )

  const unsubFarms = onSnapshot(
    query(collectionGroup(db, 'farms'), limit(100)),
    (snap) => {
      if (disposed) return
      const rows = snap.docs.map((d) =>
        mapFirestoreFarmDoc(d.id, d.ref.parent.parent?.id ?? '', d.data() as Record<string, unknown>),
      )
      rows.sort((a, b) => b.updatedMs.localeCompare(a.updatedMs))
      handlers.onFarms(rows.map((r) => r.farm))
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'farms (collectionGroup)')
    },
  )

  const unsubStorage = onSnapshot(
    query(collectionGroup(db, 'storageBatches'), limit(100)),
    (snap) => {
      if (disposed) return
      const rows = snap.docs.map((d) =>
        mapFirestoreStorageBatchDoc(d.id, d.ref.parent.parent?.id ?? '', d.data() as Record<string, unknown>),
      )
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      handlers.onStorageBatches(rows)
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'storageBatches (collectionGroup)')
    },
  )

  const unsubCases = onSnapshot(
    query(collectionGroup(db, 'cropCases'), limit(100)),
    (snap) => {
      if (disposed) return
      const rows = snap.docs.map((d) => mapFirestoreCropCaseDoc(d.id, d.data() as Record<string, unknown>))
      rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      handlers.onCropCases(rows)
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'cropCases (collectionGroup)')
    },
  )

  const unsubNotifs = onSnapshot(
    query(collectionGroup(db, 'notifications'), limit(100)),
    (snap) => {
      if (disposed) return
      const rows = snap.docs.map((d) =>
        mapFirestoreNotificationDoc(d.id, d.ref.parent.parent?.id ?? '', d.data() as Record<string, unknown>),
      )
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      handlers.onNotifications(rows)
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'notifications (collectionGroup)')
    },
  )

  const unsubAudit = onSnapshot(
    query(collection(db, 'auditLogs'), limit(100)),
    (snap) => {
      if (disposed) return
      const logs = snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          actor: String(data.actor ?? 'User'),
          role: (data.role as Role) ?? 'farmer',
          action: String(data.action ?? ''),
          target: String(data.target ?? ''),
          timestamp: toIso(data.createdAt),
        } satisfies AuditLog
      })
      logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      handlers.onAuditLogs(logs)
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'auditLogs')
    },
  )

  return () => {
    disposed = true
    if (retryTimer) clearTimeout(retryTimer)
    unsubUsers()
    unsubFarms()
    unsubStorage()
    unsubCases()
    unsubNotifs()
    unsubAudit()
  }
}

export async function updateFirebaseCropCaseReview(
  ownerId: string,
  caseId: string,
  patch: {
    reviewStatus: ReviewStatus
    status: CropCase['status']
    expertNotes: string
    expertGuidance: string
    reviewedBy: string
    reviewedAt: string
  },
): Promise<void> {
  const path = `users/${ownerId}/cropCases/${caseId}`
  try {
    await updateDoc(doc(db, 'users', ownerId, 'cropCases', caseId), {
      reviewStatus: patch.reviewStatus,
      status: patch.status,
      expertNotes: patch.expertNotes.slice(0, 2000),
      expertGuidance: patch.expertGuidance.slice(0, 2000),
      reviewedBy: patch.reviewedBy.slice(0, 120),
      reviewedAt: patch.reviewedAt.slice(0, 64),
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path)
  }
}

const FIRESTORE_SCHEMA_ROWS: BackendStatusSnapshot['singleTableSchema'] = [
  {
    table: 'Root Collection',
    entity: 'UserSummary',
    pkPattern: 'users/{uid}',
    skPattern: 'uid, role, status',
    gsi1: 'admins/{uid}',
    gsi2: 'users/{uid}/private/profile',
  },
  {
    table: 'User Subcollection',
    entity: 'WorkspaceState',
    pkPattern: 'users/{uid}/workspace/state',
    skPattern: 'savedSchemeIds, alerts',
    gsi1: 'ownerId == uid',
    gsi2: 'irrigationSchedules, customCrops',
  },
  {
    table: 'User Subcollection',
    entity: 'Farm & Plot',
    pkPattern: 'users/{uid}/farms/{farmId}',
    skPattern: 'plots[0..50]',
    gsi1: 'ownerId == uid',
    gsi2: 'collectionGroup(farms)',
  },
  {
    table: 'User Subcollection',
    entity: 'SoilReading',
    pkPattern: 'users/{uid}/soilReadings/{id}',
    skPattern: 'farmId, plotId',
    gsi1: 'ownerId == uid',
    gsi2: 'JalSense telemetry',
  },
  {
    table: 'User Subcollection',
    entity: 'StorageBatch',
    pkPattern: 'users/{uid}/storageBatches/{id}',
    skPattern: 'inspections[0..50]',
    gsi1: 'ownerId == uid',
    gsi2: 'collectionGroup(storageBatches)',
  },
  {
    table: 'User Subcollection',
    entity: 'CropCase',
    pkPattern: 'users/{uid}/cropCases/{caseId}',
    skPattern: 'status, reviewStatus',
    gsi1: 'ownerId == uid',
    gsi2: 'collectionGroup(cropCases)',
  },
  {
    table: 'Root Collection',
    entity: 'MandiPrice & Scheme',
    pkPattern: 'mandiPrices/{id} | schemes/{id}',
    skPattern: 'dataType in [sample, verified]',
    gsi1: 'createdBy == adminUid',
    gsi2: 'Shared read catalogue',
  },
  {
    table: 'Root Collection',
    entity: 'PlatformSettings & AuditLog',
    pkPattern: 'platform/settings | auditLogs/{id}',
    skPattern: 'actorUid, createdAt',
    gsi1: 'Admin config singleton',
    gsi2: 'Append-only audit trail',
  },
]

export async function listFirestoreRecordsByEntity(
  uid: string,
  isAdmin: boolean,
  entity: BackendEntityName,
  maxRows = 25,
): Promise<Record<string, unknown>[]> {
  switch (entity) {
    case 'cropCases': {
      const q = isAdmin
        ? query(collectionGroup(db, 'cropCases'), limit(maxRows))
        : query(collection(db, `users/${uid}/cropCases`), where('ownerId', '==', uid), limit(maxRows))
      const snap = await getDocs(q)
      return snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          ...data,
          farmerId: data.ownerId,
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt),
        }
      })
    }
    case 'mandiPrices': {
      const rows = await listFirestoreMandiPrices()
      return rows.slice(0, maxRows).map((r) => ({ ...r, dataType: 'sample', lastUpdatedAt: r.date }))
    }
    case 'schemes': {
      const rows = await listFirestoreSchemes()
      return rows.slice(0, maxRows).map((r) => ({ ...r, dataType: 'sample' }))
    }
    case 'storageBatches': {
      const q = isAdmin
        ? query(collectionGroup(db, 'storageBatches'), limit(maxRows))
        : query(collection(db, `users/${uid}/storageBatches`), where('ownerId', '==', uid), limit(maxRows))
      const snap = await getDocs(q)
      return snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          ...data,
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt),
        }
      })
    }
    case 'farms': {
      const q = isAdmin
        ? query(collectionGroup(db, 'farms'), limit(maxRows))
        : query(collection(db, `users/${uid}/farms`), where('ownerId', '==', uid), limit(maxRows))
      const snap = await getDocs(q)
      return snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          ...data,
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt),
        }
      })
    }
    case 'users': {
      if (!isAdmin) {
        const userSnap = await getDoc(doc(db, 'users', uid))
        if (!userSnap.exists()) return []
        const data = userSnap.data()
        return [
          {
            id: userSnap.id,
            name: data.displayName,
            role: data.role,
            status: data.status ?? 'active',
            joinedAt: toIso(data.createdAt),
            updatedAt: toIso(data.updatedAt),
          },
        ]
      }
      const rows = await listFirestoreUsersForAdmin()
      return rows.slice(0, maxRows).map((u) => ({ ...u }))
    }
    case 'notifications': {
      const q = isAdmin
        ? query(collectionGroup(db, 'notifications'), limit(maxRows))
        : query(collection(db, `users/${uid}/notifications`), where('ownerId', '==', uid), limit(maxRows))
      const snap = await getDocs(q)
      return snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          ...data,
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt),
        }
      })
    }
    case 'auditLogs': {
      const rows = await listFirestoreAuditLogs(uid, isAdmin)
      return rows.slice(0, maxRows).map((l) => ({
        id: l.id,
        action: l.action,
        actorId: l.actor,
        actorRole: l.role,
        target: l.target,
        timestamp: l.timestamp,
      }))
    }
  }
}

export async function inspectFirestoreDatabase(
  uid: string,
  isAdmin: boolean,
): Promise<BackendStatusSnapshot> {
  let serverReachable = true
  let serverMessage = `Cloud Firestore (${firebaseConfig.firestoreDatabaseId}) reachable and authenticated.`
  try {
    await getDocFromServer(doc(db, 'users', uid))
  } catch (err) {
    serverReachable = false
    serverMessage = err instanceof Error ? err.message : 'Unable to reach Cloud Firestore server.'
  }

  const entityList: BackendEntityName[] = [
    'cropCases',
    'mandiPrices',
    'schemes',
    'storageBatches',
    'farms',
    'users',
    'notifications',
    'auditLogs',
  ]
  const counts: Record<BackendEntityName, number> = {
    cropCases: 0,
    mandiPrices: 0,
    schemes: 0,
    storageBatches: 0,
    farms: 0,
    users: 0,
    notifications: 0,
    auditLogs: 0,
  }

  const results = await Promise.allSettled(
    entityList.map((entity) => listFirestoreRecordsByEntity(uid, isAdmin, entity, 100)),
  )
  entityList.forEach((entity, idx) => {
    const r = results[idx]
    counts[entity] = r.status === 'fulfilled' ? r.value.length : 0
  })

  return {
    service: 'krishi360-firestore',
    dataBackend: 'firestore',
    awsRegion: 'firebase-cloud',
    usersTableName: 'users/{uid}',
    flagTableName: firebaseConfig.firestoreDatabaseId,
    tableName: firebaseConfig.firestoreDatabaseId,
    uploadBucketName: firebaseConfig.storageBucket,
    customEndpointConfigured: false,
    awsCredentialsConfigured: false,
    s3UploadsConfigured: false,
    s3: {
      configured: false,
      reachable: false,
      bucketName: firebaseConfig.storageBucket,
      status: 'NOT_CONFIGURED',
      message: 'Cloud Firestore handles document persistence; media previews run client-side.',
    },
    aiProvider: 'gemini',
    bedrockConfigured: false,
    bedrockModelId: 'gemini-2.5-flash',
    authMode: 'firebase-google',
    dynamo: {
      reachable: serverReachable,
      tableStatus: serverReachable ? 'ACTIVE' : 'UNREACHABLE',
      billingMode: 'CLOUD_FIRESTORE',
      approximateItemCount: Object.values(counts).reduce((sum, n) => sum + n, 0),
      gsiNames: ['ownerId', 'dataType', 'collectionGroup'],
      message: serverMessage,
    },
    usersDynamo: {
      reachable: serverReachable,
      tableStatus: serverReachable ? 'ACTIVE' : 'UNREACHABLE',
      billingMode: 'FIRESTORE_AUTH',
      approximateItemCount: counts.users,
      gsiNames: ['users/{uid}', 'users/{uid}/private/profile'],
      message: `${counts.users} user summary document(s) in Cloud Firestore.`,
    },
    flagDynamo: {
      reachable: serverReachable,
      tableStatus: serverReachable ? 'ACTIVE' : 'UNREACHABLE',
      billingMode: 'CLOUD_FIRESTORE',
      approximateItemCount: Object.values(counts).reduce((sum, n) => sum + n, 0),
      gsiNames: ['farms', 'storageBatches', 'cropCases', 'mandiPrices', 'schemes'],
      message: `Connected to Firestore database "${firebaseConfig.firestoreDatabaseId}" in project "${firebaseConfig.projectId}".`,
    },
    firestore: {
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId,
      serverReachable,
      message: serverMessage,
    },
    counts,
    singleTableSchema: FIRESTORE_SCHEMA_ROWS,
    endpoints: [
      {
        method: 'GET',
        path: 'firestore:/users/{uid}/workspace/state',
        module: 'Workspace & Preferences',
        auth: 'Authenticated',
        description: 'Reads saved schemes, alerts, irrigation schedules, custom crops & user preferences.',
      },
      {
        method: 'GET',
        path: 'firestore:/users/{uid}/farms',
        module: 'My Farm & JalSense',
        auth: 'Authenticated',
        description: 'Lists farmer plots, soil types, and irrigation telemetry.',
      },
      {
        method: 'GET',
        path: 'firestore:/users/{uid}/storageBatches',
        module: 'GrainGuard',
        auth: 'Authenticated',
        description: 'Lists post-harvest storage batches, sensor readings, and inspection logs.',
      },
      {
        method: 'GET',
        path: 'firestore:/users/{uid}/cropCases',
        module: 'CropDoctor AI',
        auth: 'Authenticated',
        description: 'Stores analyzed crop cases and expert review statuses.',
      },
      {
        method: 'GET',
        path: 'firestore:/mandiPrices',
        module: 'Mandi Intelligence',
        auth: 'Authenticated',
        description: 'Reads shared mandi market price records.',
      },
      {
        method: 'GET',
        path: 'firestore:/schemes',
        module: 'Scheme Explorer',
        auth: 'Authenticated',
        description: 'Reads shared government scheme catalogue records.',
      },
      {
        method: 'GET',
        path: 'firestore:/platform/settings',
        module: 'Platform Config',
        auth: 'Admin only',
        description: 'Stores SLA hours, storage alert thresholds, and global defaults.',
      },
      {
        method: 'GET',
        path: 'firestore:/auditLogs',
        module: 'Audit Trail',
        auth: 'Admin only',
        description: 'Append-only action trail recorded from portal mutations.',
      },
    ],
    checkedAt: new Date().toISOString(),
  }
}

export async function exportFirestoreSnapshot(
  uid: string,
  isAdmin: boolean,
): Promise<Record<string, unknown>> {
  const entities: BackendEntityName[] = [
    'cropCases',
    'mandiPrices',
    'schemes',
    'storageBatches',
    'farms',
    'users',
    'notifications',
    'auditLogs',
  ]
  const collections: Record<string, unknown[]> = {}
  const settled = await Promise.allSettled(
    entities.map((e) => listFirestoreRecordsByEntity(uid, isAdmin, e, 100)),
  )
  entities.forEach((entity, idx) => {
    collections[entity] = settled[idx].status === 'fulfilled' ? settled[idx].value : []
  })
  const settings = await getFirebasePlatformSettings().catch(() => null)
  return {
    exportedAt: new Date().toISOString(),
    engine: 'cloud-firestore',
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    settings,
    collections,
  }
}

export async function seedFirestoreSampleData(
  uid: string,
  isAdmin: boolean,
): Promise<BackendStatusSnapshot> {
  let inserted = 0
  let skipped = 0

  const existingFarms = await listFirestoreRecordsByEntity(uid, false, 'farms', 5)
  if (existingFarms.length === 0) {
    await createFirebaseFarm(uid, {
      name: 'Sahyadri Demo Farm',
      location: 'Nashik, Maharashtra',
      areaHa: 4.5,
      soilType: 'Black cotton',
      irrigationType: 'Drip irrigation',
      plots: [
        {
          id: 'PLOT-1',
          name: 'North Tomato Block',
          areaHa: 2.0,
          crop: 'Tomato',
          growthStage: 'Flowering',
          soilMoisture: 44,
          lastIrrigated: new Date().toISOString().slice(0, 10),
          status: 'healthy',
        },
        {
          id: 'PLOT-2',
          name: 'East Onion Plot',
          areaHa: 2.5,
          crop: 'Onion',
          growthStage: 'Vegetative',
          soilMoisture: 36,
          lastIrrigated: new Date().toISOString().slice(0, 10),
          status: 'watch',
        },
      ],
    })
    inserted += 1
  } else {
    skipped += 1
  }

  const existingBatches = await listFirestoreRecordsByEntity(uid, false, 'storageBatches', 5)
  if (existingBatches.length === 0) {
    await createFirebaseStorageBatch(uid, {
      id: 'BATCH-SEED-1',
      code: 'GG-NASHIK-01',
      crop: 'Onion',
      quantityKg: 2400,
      location: 'Nashik Packhouse Bay 2',
      tempC: 23.4,
      humidity: 61,
      minTemp: 15,
      maxTemp: 28,
      maxHumidity: 70,
      status: 'normal',
      createdAt: new Date().toISOString(),
      inspections: [],
    })
    inserted += 1
  } else {
    skipped += 1
  }

  const existingCases = await listFirestoreRecordsByEntity(uid, false, 'cropCases', 5)
  if (existingCases.length === 0) {
    await createFirebaseCropCase(uid, {
      id: safeId('CASE'),
      farmerId: uid,
      farmerName: auth.currentUser?.displayName || 'Farmer',
      crop: 'Tomato',
      plantPart: 'Leaf',
      location: 'Nashik, Maharashtra',
      symptoms: 'Circular dark brown spots with yellow halo on lower leaves.',
      imageUrl: '/sample-leaf.svg',
      condition: 'Possible early blight',
      confidence: 78,
      alternatives: [{ name: 'Septoria leaf spot', confidence: 18 }],
      observedSymptoms: ['Concentric brown lesions', 'Yellow haloing'],
      explanation: 'Seeded reference crop case persisted in Cloud Firestore.',
      nextSteps: [
        'Inspect older foliage in daylight.',
        'Avoid overhead irrigation until reviewed by an expert.',
      ],
      recommendExpert: true,
      provider: 'heuristic',
      simulated: true,
      status: 'ai_review',
      priority: 'medium',
      submittedAt: new Date().toISOString(),
      reviewStatus: 'pending',
    })
    inserted += 1
  } else {
    skipped += 1
  }

  if (isAdmin) {
    const existingMandi = await listFirestoreMandiPrices()
    if (existingMandi.length === 0) {
      for (const sample of DEMO_MANDI_PRICES.slice(0, 4)) {
        await createFirebaseMandiPrice(uid, {
          crop: sample.crop,
          state: sample.state,
          district: sample.district,
          mandi: sample.mandi,
          minPrice: sample.minPrice,
          maxPrice: sample.maxPrice,
          modalPrice: sample.modalPrice,
          changePct: sample.changePct,
          date: sample.date,
          source: sample.source,
          dataType: 'sample',
        })
        inserted += 1
      }
    } else {
      skipped += 1
    }

    const existingSchemes = await listFirestoreSchemes()
    if (existingSchemes.length === 0) {
      for (const sample of DEMO_SCHEMES.slice(0, 4)) {
        await createFirebaseScheme(uid, {
          id: sample.id,
          name: sample.name,
          category: sample.category,
          state: sample.state,
          summary: sample.summary,
          eligibility: sample.eligibility,
          documents: sample.documents,
          sourceLabel: sample.sourceLabel,
          sourceUrl: sample.sourceUrl,
          tags: sample.tags,
          dataType: 'sample',
        })
        inserted += 1
      }
    } else {
      skipped += 1
    }

    const settings = await getFirebasePlatformSettings()
    if (!settings) {
      await saveFirebasePlatformSettings(uid, {
        language: 'English',
        notificationsEnabled: true,
        demoMode: true,
        compactTables: false,
        expertReviewSlaHours: 24,
        storageAlertTemp: 28,
        storageAlertHumidity: 70,
      })
      inserted += 1
    } else {
      skipped += 1
    }
  }

  await createFirebaseAuditLog(uid, {
    actor: auth.currentUser?.displayName || 'User',
    role: isAdmin ? 'admin' : 'farmer',
    action: 'Seeded missing Firestore records',
    target: `inserted=${inserted}, skipped=${skipped}`,
  })

  const status = await inspectFirestoreDatabase(uid, isAdmin)
  return {
    ...status,
    seedResult: { inserted, skipped },
  }
}
