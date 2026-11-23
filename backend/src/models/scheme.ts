/** SchemeSaathi domain models. */

import type { DataType } from './mandi';

export type RuleField = 'state' | 'landHoldingHa' | 'annualIncomeINR' | 'age' | 'category' | 'gender';
export type RuleOp = 'eq' | 'neq' | 'lte' | 'gte' | 'in';

/** Structured, machine-checkable eligibility criterion. */
export interface EligibilityRule {
  field: RuleField;
  op: RuleOp;
  value: string | number | string[];
  description: string;
}

export interface Scheme {
  id: string;
  name: string;
  category: string;
  /** Indian state name, or "All India" for central schemes. */
  state: string;
  summary: string;
  /** Human-readable criteria shown in the UI. */
  eligibility: string[];
  /** Structured rules used by the eligibility checker. */
  eligibilityRules: EligibilityRule[];
  documents: string[];
  sourceLabel: string;
  sourceUrl: string;
  tags: string[];
  dataType: DataType;
  lastUpdatedAt: string;
  createdAt: string;
  version: number;
}

export interface FarmerProfile {
  state?: string;
  landHoldingHa?: number;
  annualIncomeINR?: number;
  age?: number;
  category?: string;
  gender?: string;
}

export type CriterionResult = 'met' | 'not_met' | 'unknown';

export interface EligibilityCheckResult {
  schemeId: string;
  schemeName: string;
  outcome: 'likely_eligible' | 'likely_not_eligible' | 'insufficient_information';
  criteria: Array<{ description: string; result: CriterionResult }>;
  documents: string[];
  sourceLabel: string;
  sourceUrl: string;
  lastUpdatedAt: string;
  disclaimer: string;
}

export const ELIGIBILITY_DISCLAIMER =
  'Indicative check based only on the details you provided and the stored scheme summary. This is NOT a confirmation of eligibility, benefit amount or approval. Verify current rules and apply only through the official source.';