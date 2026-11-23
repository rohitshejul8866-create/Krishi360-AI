import type { AuthUser } from '../middleware/auth';
import type { MandiPrice } from '../models/mandi';
import type { MandiFilters, MandiRepository } from '../repositories/types';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { makeId, nowIso } from '../utils/ids';
import type { Page, PageRequest } from '../utils/pagination';
import type { Logger } from '../utils/logger';
import type { AuditService } from './auditService';

export type MandiCreateInput = Omit<MandiPrice, 'id' | 'lastUpdatedAt' | 'createdAt' | 'version'>;

export class MandiService {
  constructor(private repo: MandiRepository, private audit: AuditService) {}

  async list(filters: MandiFilters, page: PageRequest): Promise<{ page: Page<MandiPrice>; simulated: boolean }> {
    const result = await this.repo.query(filters, page);
    // The envelope flags simulated=true only when EVERY returned record is sample data.
    const simulated = result.items.length > 0 && result.items.every((p) => p.dataType === 'sample');
    return { page: result, simulated };
  }

  async get(id: string): Promise<{ price: MandiPrice; simulated: boolean }> {
    const price = await this.repo.get(id);
    if (!price) throw new NotFoundError('Mandi price record not found.');
    return { price, simulated: price.dataType === 'sample' };
  }

  /** Admin-only ingestion. `dataType` must honestly reflect the source. */
  async create(user: AuthUser, input: MandiCreateInput, logger: Logger): Promise<MandiPrice> {
    if (user.role !== 'admin') throw new ForbiddenError('Only admins can add mandi price records.');
    const ts = nowIso();
    const price: MandiPrice = {
      ...input,
      id: makeId('PRICE'),
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1,
    };
    await this.repo.put(price);
    await this.audit.record(logger, user, 'mandi.price_created', price.id, {
      crop: price.crop,
      dataType: price.dataType,
    });
    return price;
  }
}