import type { AuthUser } from '../middleware/auth';
import type { AiAnalysis, CropCase, ExpertReview } from '../models/cropCase';
import type { CropCaseRepository } from '../repositories/types';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { makeId, nowIso } from '../utils/ids';
import type { Page, PageRequest } from '../utils/pagination';
import type { Logger } from '../utils/logger';
import type { AiAnalysisService } from './ai/types';
import type { AuditService } from './auditService';
import type { PresignedUpload, UploadRequest, UploadService } from './uploadService';

export interface CreateCaseInput {
  crop: string;
  plantPart: string;
  location: string;
  symptoms: string;
  imageUrl?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface ExpertReviewInput {
  notes: string;
  guidance: string;
  status: 'in_review' | 'completed' | 'needs_info';
  confirmedCondition?: string;
}

/** Statuses in which an unassigned case is visible to the expert review queue. */
const REVIEW_QUEUE_STATUSES = new Set(['new', 'ai_review', 'expert_review']);

export class CropDoctorService {
  constructor(
    private cases: CropCaseRepository,
    private ai: AiAnalysisService,
    private uploads: UploadService,
    private audit: AuditService,
  ) {}

  /**
   * Access rules (enforced server-side):
   * - admin: any case
   * - farmer: only their own case
   * - expert: cases assigned to them, or unassigned cases in the review queue
   * Cross-tenant access returns 404 so ids cannot be enumerated.
   */
  private assertAccess(user: AuthUser, cropCase: CropCase): void {
    if (user.role === 'admin') return;
    if (user.role === 'farmer') {
      if (cropCase.farmerId !== user.id) throw new NotFoundError('Crop case not found.');
      return;
    }
    const assignedToMe = cropCase.assignedExpertId === user.id;
    const inQueue = cropCase.assignedExpertId === undefined && REVIEW_QUEUE_STATUSES.has(cropCase.status);
    if (!assignedToMe && !inQueue) throw new NotFoundError('Crop case not found.');
  }

  private async getAccessible(user: AuthUser, id: string): Promise<CropCase> {
    const cropCase = await this.cases.get(id);
    if (!cropCase) throw new NotFoundError('Crop case not found.');
    this.assertAccess(user, cropCase);
    return cropCase;
  }

  async createCase(user: AuthUser, input: CreateCaseInput, logger: Logger): Promise<CropCase> {
    if (user.role !== 'farmer' && user.role !== 'admin') {
      throw new ForbiddenError('Only farmers or admins can create crop cases.');
    }
    const ts = nowIso();
    const cropCase: CropCase = {
      id: makeId('CASE'),
      farmerId: user.id,
      ...(user.name ? { farmerName: user.name } : {}),
      crop: input.crop,
      plantPart: input.plantPart,
      location: input.location,
      symptoms: input.symptoms,
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
      status: 'new',
      priority: input.priority ?? 'medium',
      reviewStatus: 'pending',
      createdAt: ts,
      updatedAt: ts,
      version: 1,
    };
    await this.cases.create(cropCase);
    await this.audit.record(logger, user, 'crop_case.created', cropCase.id, { crop: cropCase.crop });
    return cropCase;
  }

  async listCases(
    user: AuthUser,
    page: PageRequest,
    status?: CropCase['status'],
  ): Promise<Page<CropCase>> {
    if (user.role === 'farmer') return this.cases.listByFarmer(user.id, page, status);
    if (user.role === 'expert') return this.cases.listForExpert(user.id, page, status);
    return this.cases.listAll(page, status);
  }

  getCase(user: AuthUser, id: string): Promise<CropCase> {
    return this.getAccessible(user, id);
  }

  async createUploadUrl(user: AuthUser, id: string, request: UploadRequest, logger: Logger): Promise<PresignedUpload> {
    const cropCase = await this.getAccessible(user, id);
    if (user.role === 'expert') throw new ForbiddenError('Experts cannot upload images to a case.');
    const upload = await this.uploads.createUpload(cropCase, request);
    await this.audit.record(logger, user, 'crop_case.upload_url_issued', id, { imageKey: upload.imageKey });
    return upload;
  }

  async requestAnalysis(
    user: AuthUser,
    id: string,
    imageKey: string | undefined,
    logger: Logger,
  ): Promise<{ case: CropCase; analysis: AiAnalysis }> {
    const cropCase = await this.getAccessible(user, id);
    if (user.role === 'expert') throw new ForbiddenError('Experts review cases; analysis is requested by the owner.');
    if (imageKey) this.uploads.assertKeyBelongsToCase(cropCase, imageKey);
    const effectiveKey = imageKey ?? cropCase.imageKey;

    const analysis = await this.ai.analyze({
      crop: cropCase.crop,
      plantPart: cropCase.plantPart,
      location: cropCase.location,
      symptoms: cropCase.symptoms,
      ...(effectiveKey ? { imageKey: effectiveKey } : {}),
    });

    const updated: CropCase = {
      ...cropCase,
      ...(effectiveKey ? { imageKey: effectiveKey } : {}),
      aiAnalysis: analysis,
      status: 'ai_review',
      reviewStatus: 'pending',
      updatedAt: nowIso(),
      version: cropCase.version + 1,
    };
    await this.cases.update(updated, cropCase.version);
    await this.audit.record(logger, user, 'crop_case.analysis_requested', id, { provider: analysis.provider });
    return { case: updated, analysis };
  }

  async expertReview(user: AuthUser, id: string, input: ExpertReviewInput, logger: Logger): Promise<CropCase> {
    if (user.role !== 'expert' && user.role !== 'admin') {
      throw new ForbiddenError('Only experts or admins can review cases.');
    }
    const cropCase = await this.getAccessible(user, id);
    if (input.status === 'completed' && !input.confirmedCondition && !cropCase.aiAnalysis) {
      throw new ValidationError('A completed review needs a confirmedCondition when no AI analysis exists.');
    }

    const review: ExpertReview = {
      reviewedBy: user.id,
      ...(user.name ? { reviewerName: user.name } : {}),
      notes: input.notes,
      guidance: input.guidance,
      ...(input.confirmedCondition ? { confirmedCondition: input.confirmedCondition } : {}),
      status: input.status,
      reviewedAt: nowIso(),
    };

    const updated: CropCase = {
      ...cropCase,
      expertReview: review,
      assignedExpertId: user.role === 'expert' ? user.id : cropCase.assignedExpertId,
      reviewStatus: input.status,
      status: input.status === 'completed' ? 'resolved' : 'expert_review',
      updatedAt: nowIso(),
      version: cropCase.version + 1,
    };
    await this.cases.update(updated, cropCase.version);
    await this.audit.record(logger, user, 'crop_case.expert_reviewed', id, { reviewStatus: input.status });
    return updated;
  }
}