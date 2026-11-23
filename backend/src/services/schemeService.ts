import type { EligibilityRule, FarmerProfile, Scheme } from '../models/scheme';
import { ELIGIBILITY_DISCLAIMER, type CriterionResult, type EligibilityCheckResult } from '../models/scheme';
import type { SchemeFilters, SchemeRepository } from '../repositories/types';
import { NotFoundError } from '../utils/errors';
import type { Page, PageRequest } from '../utils/pagination';

function evaluateRule(rule: EligibilityRule, profile: FarmerProfile): CriterionResult {
  const actual = profile[rule.field];
  if (actual === undefined || actual === null || actual === '') return 'unknown';

  switch (rule.op) {
    case 'eq':
      if (rule.field === 'state') {
        // Central schemes ("All India") apply to every state.
        return actual === rule.value || rule.value === 'All India' ? 'met' : 'not_met';
      }
      return String(actual).toLowerCase() === String(rule.value).toLowerCase() ? 'met' : 'not_met';
    case 'neq':
      return String(actual).toLowerCase() !== String(rule.value).toLowerCase() ? 'met' : 'not_met';
    case 'lte':
      return typeof actual === 'number' && typeof rule.value === 'number' && actual <= rule.value ? 'met' : 'not_met';
    case 'gte':
      return typeof actual === 'number' && typeof rule.value === 'number' && actual >= rule.value ? 'met' : 'not_met';
    case 'in':
      return Array.isArray(rule.value) && rule.value.map((v) => v.toLowerCase()).includes(String(actual).toLowerCase())
        ? 'met'
        : 'not_met';
    default:
      return 'unknown';
  }
}

export class SchemeService {
  constructor(private repo: SchemeRepository) {}

  async list(filters: SchemeFilters, page: PageRequest): Promise<{ page: Page<Scheme>; simulated: boolean }> {
    const result = await this.repo.list(filters, page);
    const simulated = result.items.length > 0 && result.items.every((s) => s.dataType === 'sample');
    return { page: result, simulated };
  }

  async get(id: string): Promise<{ scheme: Scheme; simulated: boolean }> {
    const scheme = await this.repo.get(id);
    if (!scheme) throw new NotFoundError('Scheme not found.');
    return { scheme, simulated: scheme.dataType === 'sample' };
  }

  /**
   * Indicative eligibility check. NEVER guarantees eligibility or approval;
   * missing profile fields produce "unknown", not assumptions.
   */
  async checkEligibility(schemeId: string, profile: FarmerProfile): Promise<EligibilityCheckResult> {
    const scheme = await this.repo.get(schemeId);
    if (!scheme) throw new NotFoundError('Scheme not found.');

    const criteria = scheme.eligibilityRules.map((rule) => ({
      description: rule.description,
      result: evaluateRule(rule, profile),
    }));

    const outcome: EligibilityCheckResult['outcome'] = criteria.some((c) => c.result === 'not_met')
      ? 'likely_not_eligible'
      : criteria.length > 0 && criteria.every((c) => c.result === 'met')
        ? 'likely_eligible'
        : 'insufficient_information';

    return {
      schemeId: scheme.id,
      schemeName: scheme.name,
      outcome,
      criteria,
      documents: scheme.documents,
      sourceLabel: scheme.sourceLabel,
      sourceUrl: scheme.sourceUrl,
      lastUpdatedAt: scheme.lastUpdatedAt,
      disclaimer: ELIGIBILITY_DISCLAIMER,
    };
  }
}