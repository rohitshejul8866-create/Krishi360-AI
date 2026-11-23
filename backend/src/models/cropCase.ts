/** CropDoctor AI domain models. AI analysis and expert review are kept separate. */

export type CaseStatus = 'new' | 'ai_review' | 'expert_review' | 'resolved';
export type ReviewStatus = 'pending' | 'in_review' | 'completed' | 'needs_info';
export type Priority = 'low' | 'medium' | 'high';

export interface CaseAlternative {
  name: string;
  confidence: number;
}

/**
 * Output of an AI provider. `verified` is ALWAYS false here — only an
 * ExpertReview can confirm a diagnosis. Dosage instructions are never part
 * of this payload.
 */
export interface AiAnalysis {
  provider: 'bedrock' | 'heuristic';
  modelId?: string;
  condition: string;
  confidence: number;
  uncertainty: string;
  alternatives: CaseAlternative[];
  observedSymptoms: string[];
  explanation: string;
  nextSteps: string[];
  recommendExpert: boolean;
  verified: false;
  simulated: boolean;
  disclaimer: string;
  analyzedAt: string;
}

export interface ExpertReview {
  reviewedBy: string;
  reviewerName?: string;
  notes: string;
  guidance: string;
  confirmedCondition?: string;
  status: 'in_review' | 'completed' | 'needs_info';
  reviewedAt: string;
}

export interface CropCase {
  id: string;
  farmerId: string;
  farmerName?: string;
  crop: string;
  plantPart: string;
  location: string;
  symptoms: string;
  imageKey?: string;
  imageUrl?: string;
  status: CaseStatus;
  priority: Priority;
  reviewStatus: ReviewStatus;
  assignedExpertId?: string;
  aiAnalysis?: AiAnalysis;
  expertReview?: ExpertReview;
  createdAt: string;
  updatedAt: string;
  /** Optimistic-locking version for DynamoDB conditional writes. */
  version: number;
}

export const AI_DISCLAIMER =
  'Unverified AI-assisted suggestion — not a confirmed diagnosis. Confirm with a qualified local expert before taking any action. No pesticide dosage is provided from image analysis.';

export const HEURISTIC_DISCLAIMER =
  'Simulated demo analysis from deterministic rules — not a diagnosis and not a live AI result. Confirm with a qualified local expert before taking any action.';