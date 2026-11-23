export type Role = 'farmer' | 'expert' | 'admin'
export type Severity = 'info' | 'success' | 'warning' | 'critical'
export type CaseStatus = 'new' | 'ai_review' | 'expert_review' | 'resolved'
export type ReviewStatus = 'pending' | 'in_review' | 'completed' | 'needs_info'
export type Priority = 'low' | 'medium' | 'high'
export type UserStatus = 'active' | 'invited' | 'suspended'
export type StorageStatus = 'normal' | 'warning' | 'critical'

export interface DemoUser {
  id: string
  name: string
  email: string
  role: Role
  location: string
  phone: string
  status: UserStatus
  joinedAt: string
  avatar: string
  organisation?: string
  specialisation?: string
}

export interface Plot {
  id: string
  name: string
  areaHa: number
  crop: string
  growthStage: string
  soilMoisture: number
  lastIrrigated: string
  status: 'healthy' | 'watch' | 'attention'
}

export interface Farm {
  id: string
  farmerId: string
  name: string
  location: string
  areaHa: number
  soilType: string
  irrigationType: string
  plots: Plot[]
}

export interface Crop {
  id: string
  name: string
  category: string
  season: string
  durationDays: number
  waterNeed: 'low' | 'medium' | 'high'
  icon: string
}

export interface CaseAlternative {
  name: string
  confidence: number
}

export interface CropCase {
  id: string
  farmerId: string
  farmerName: string
  crop: string
  plantPart: string
  location: string
  symptoms: string
  imageUrl: string
  condition: string
  confidence: number
  alternatives: CaseAlternative[]
  observedSymptoms: string[]
  explanation: string
  nextSteps: string[]
  recommendExpert: boolean
  status: CaseStatus
  priority: Priority
  submittedAt: string
  reviewStatus: ReviewStatus
  expertNotes?: string
  expertGuidance?: string
  reviewedAt?: string
  reviewedBy?: string
}

export interface AnalysisInput {
  crop: string
  plantPart: string
  location: string
  symptoms: string
  imageUrl: string
  imageName: string
}

export interface AnalysisResult {
  condition: string
  confidence: number
  alternatives: CaseAlternative[]
  observedSymptoms: string[]
  explanation: string
  nextSteps: string[]
  recommendExpert: boolean
  disclaimer: string
}

export interface MandiPrice {
  id: string
  crop: string
  state: string
  district: string
  mandi: string
  minPrice: number
  maxPrice: number
  modalPrice: number
  date: string
  source: string
  changePct: number
}

export interface MandiAlert {
  id: string
  crop: string
  district: string
  targetPrice: number
  createdAt: string
}

export interface IrrigationRecord {
  id: string
  plotId: string
  crop: string
  date: string
  durationMin: number
  waterLitres: number
  method: string
  moistureBefore: number
  moistureAfter: number
}

export interface IrrigationSchedule {
  id: string
  plot: string
  crop: string
  stage: string
  nextDate: string
  reminder: boolean
}

export interface IrrigationInput {
  plot: string
  crop: string
  stage: string
  soilType: string
  moisture: number
  weather: string
  temperature: number
}

export interface IrrigationRecommendation {
  headline: string
  action: 'irrigate-now' | 'schedule' | 'hold'
  waterLitres: number
  durationMin: number
  bestWindow: string
  reasoning: string[]
  confidenceNote: string
}

export interface Inspection {
  id: string
  date: string
  inspector: string
  notes: string
  condition: StorageStatus
}

export interface StorageBatch {
  id: string
  code: string
  crop: string
  quantityKg: number
  location: string
  tempC: number
  humidity: number
  minTemp: number
  maxTemp: number
  maxHumidity: number
  status: StorageStatus
  createdAt: string
  inspections: Inspection[]
}

export interface Scheme {
  id: string
  name: string
  category: string
  state: string
  summary: string
  eligibility: string[]
  documents: string[]
  sourceLabel: string
  sourceUrl: string
  tags: string[]
}

export interface SchemeApplication {
  id: string
  schemeId: string
  farmerId: string
  progress: number
  stage: string
  updatedAt: string
}

export interface NotificationItem {
  id: string
  title: string
  body: string
  severity: Severity
  createdAt: string
  read: boolean
  audience: Role | 'all'
}

export interface AuditLog {
  id: string
  actor: string
  role: Role
  action: string
  target: string
  timestamp: string
}

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  time: string
}

export interface PlatformSettings {
  language: string
  notificationsEnabled: boolean
  demoMode: boolean
  compactTables: boolean
  expertReviewSlaHours: number
  storageAlertTemp: number
  storageAlertHumidity: number
}

export interface ApiEnvelope<T> {
  data: T
  meta: {
    source: string
    simulated: boolean
    timestamp: string
  }
}
