import type {
  AnalysisResult,
  AuditLog,
  CaseAlternative,
  CropCase,
  IrrigationRecommendation,
  MandiPrice,
  Priority,
  ReviewStatus,
  Role,
  Scheme,
  StorageBatch,
  StorageStatus,
} from '../types'
import { ANALYSIS_DISCLAIMER } from './cropDoctorService'

export interface BackendPaginated<T> {
  items: T[]
  nextToken: string | null
}

export interface BackendAiAnalysis {
  provider: 'bedrock' | 'heuristic'
  modelId?: string
  condition: string
  confidence: number
  uncertainty: string
  alternatives: CaseAlternative[]
  observedSymptoms: string[]
  explanation: string
  nextSteps: string[]
  recommendExpert: boolean
  verified: false
  simulated: boolean
  disclaimer: string
  analyzedAt: string
}

export interface BackendCropCase {
  id: string
  farmerId: string
  farmerName?: string
  crop: string
  plantPart: string
  location: string
  symptoms: string
  imageKey?: string
  imageUrl?: string
  status: CropCase['status']
  priority: Priority
  reviewStatus: ReviewStatus
  assignedExpertId?: string
  aiAnalysis?: BackendAiAnalysis
  expertReview?: {
    reviewedBy: string
    reviewerName?: string
    notes: string
    guidance: string
    confirmedCondition?: string
    status: 'in_review' | 'completed' | 'needs_info'
    reviewedAt: string
  }
  createdAt: string
  updatedAt: string
}

export interface BackendMandiPrice {
  id: string
  crop: string
  state: string
  district: string
  mandi: string
  minPrice: number
  maxPrice: number
  modalPrice: number
  unit: string
  date: string
  source: string
  dataType: 'sample' | 'verified'
  changePct?: number
}

export interface BackendStorageBatch {
  id: string
  ownerId: string
  code: string
  crop: string
  quantityKg: number
  location: string
  thresholds: { minTempC: number; maxTempC: number; maxHumidity: number }
  currentReading?: { tempC: number; humidity: number; source: 'manual' | 'simulated'; recordedAt: string }
  status: StorageStatus
  createdAt: string
  updatedAt: string
}

export interface BackendInspection {
  id: string
  batchId: string
  inspectorId: string
  inspectorName?: string
  notes: string
  condition: StorageStatus
  createdAt: string
}

export interface BackendAuditEntry {
  id: string
  actorId: string
  actorRole: Role
  action: string
  target: string
  details?: Record<string, unknown>
  timestamp: string
}

export interface BackendFarm {
  id: string
  farmerId: string
  name: string
  location: string
  areaHa: number
  soilType: string
  irrigationType: string
  plots: Array<{ id: string; name: string; areaHa: number; crop: string; growthStage: string }>
}

export interface BackendSoilReading {
  id: string
  farmId: string
  plotId: string
  soilMoisture: number
  source: 'manual' | 'simulated'
  weather?: { condition: string; temperatureC?: number; rainfallMm?: number }
  notes?: string
  recommendation: IrrigationRecommendation
  recordedBy: string
  createdAt: string
}

export interface BackendEligibilityResult {
  schemeId: string
  schemeName: string
  outcome: 'likely_eligible' | 'likely_not_eligible' | 'insufficient_information'
  criteria: Array<{ description: string; result: 'met' | 'not_met' | 'unknown' }>
  documents: string[]
  sourceLabel: string
  sourceUrl: string
  lastUpdatedAt: string
  disclaimer: string
}

export function mapAnalysisResult(ai: BackendAiAnalysis): AnalysisResult {
  return {
    condition: ai.condition,
    confidence: ai.confidence,
    alternatives: ai.alternatives,
    observedSymptoms: ai.observedSymptoms,
    explanation: ai.explanation,
    nextSteps: ai.nextSteps,
    recommendExpert: ai.recommendExpert,
    disclaimer: ai.disclaimer || ANALYSIS_DISCLAIMER,
  }
}

export function mapCropCase(item: BackendCropCase): CropCase {
  return {
    id: item.id,
    farmerId: item.farmerId,
    farmerName: item.farmerName ?? item.farmerId,
    crop: item.crop,
    plantPart: item.plantPart,
    location: item.location,
    symptoms: item.symptoms,
    imageUrl: item.imageUrl || '/sample-leaf.svg',
    condition: item.expertReview?.confirmedCondition ?? item.aiAnalysis?.condition ?? 'Pending analysis',
    confidence: item.aiAnalysis?.confidence ?? 0,
    alternatives: item.aiAnalysis?.alternatives ?? [],
    observedSymptoms: item.aiAnalysis?.observedSymptoms ?? [],
    explanation: item.aiAnalysis?.explanation ?? 'Awaiting AI pattern analysis.',
    nextSteps: item.aiAnalysis?.nextSteps ?? [],
    recommendExpert: item.aiAnalysis?.recommendExpert ?? true,
    status: item.status,
    priority: item.priority,
    submittedAt: item.createdAt,
    reviewStatus: item.reviewStatus,
    expertNotes: item.expertReview?.notes,
    expertGuidance: item.expertReview?.guidance,
    reviewedAt: item.expertReview?.reviewedAt,
    reviewedBy: item.expertReview?.reviewerName ?? item.expertReview?.reviewedBy,
  }
}

export function mapMandiPrice(item: BackendMandiPrice): MandiPrice {
  return {
    id: item.id,
    crop: item.crop,
    state: item.state,
    district: item.district,
    mandi: item.mandi,
    minPrice: item.minPrice,
    maxPrice: item.maxPrice,
    modalPrice: item.modalPrice,
    date: item.date,
    source: item.source,
    changePct: item.changePct ?? 0,
  }
}

export function mapStorageBatch(batch: BackendStorageBatch, inspections: BackendInspection[] = []): StorageBatch {
  return {
    id: batch.id,
    code: batch.code,
    crop: batch.crop,
    quantityKg: batch.quantityKg,
    location: batch.location,
    tempC: batch.currentReading?.tempC ?? batch.thresholds.minTempC,
    humidity: batch.currentReading?.humidity ?? batch.thresholds.maxHumidity,
    minTemp: batch.thresholds.minTempC,
    maxTemp: batch.thresholds.maxTempC,
    maxHumidity: batch.thresholds.maxHumidity,
    status: batch.status,
    createdAt: batch.createdAt,
    inspections: inspections.map((i) => ({
      id: i.id,
      date: i.createdAt,
      inspector: i.inspectorName ?? i.inspectorId,
      notes: i.notes,
      condition: i.condition,
    })),
  }
}

export function mapScheme(item: Scheme & Record<string, unknown>): Scheme {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    state: item.state,
    summary: item.summary,
    eligibility: item.eligibility,
    documents: item.documents,
    sourceLabel: item.sourceLabel,
    sourceUrl: item.sourceUrl,
    tags: item.tags,
  }
}

export function mapAuditEntry(item: BackendAuditEntry): AuditLog {
  return {
    id: item.id,
    actor: item.actorId,
    role: item.actorRole,
    action: item.action,
    target: item.target,
    timestamp: item.timestamp,
  }
}
