/**
 * SAMPLE seed data for local development only.
 * Every record is explicitly labelled dataType='sample'. None of this is live
 * market data, verified scheme text or real sensor telemetry.
 */

import type { MandiPrice } from '../models/mandi';
import type { Scheme } from '../models/scheme';
import type { MandiRepository, SchemeRepository } from '../repositories/types';
import { nowIso } from '../utils/ids';

const SAMPLE_SOURCE = 'Sample dataset (local dev) — NOT live market data';

export function sampleMandiPrices(): MandiPrice[] {
  const ts = nowIso();
  const base = { unit: 'INR/quintal', source: SAMPLE_SOURCE, dataType: 'sample' as const, lastUpdatedAt: ts, createdAt: ts, version: 1 };
  return [
    { ...base, id: 'PRICE-sample01', crop: 'Tomato', state: 'Maharashtra', district: 'Nashik', mandi: 'Nashik APMC', minPrice: 1420, maxPrice: 2180, modalPrice: 1840, date: '2026-11-21', changePct: 4.2 },
    { ...base, id: 'PRICE-sample02', crop: 'Tomato', state: 'Maharashtra', district: 'Pune', mandi: 'Pune Market Yard', minPrice: 1300, maxPrice: 2050, modalPrice: 1720, date: '2026-11-21', changePct: -1.8 },
    { ...base, id: 'PRICE-sample03', crop: 'Wheat', state: 'Madhya Pradesh', district: 'Indore', mandi: 'Indore Mandi', minPrice: 2210, maxPrice: 2480, modalPrice: 2350, date: '2026-11-21', changePct: 0.6 },
    { ...base, id: 'PRICE-sample04', crop: 'Onion', state: 'Maharashtra', district: 'Nashik', mandi: 'Lasalgaon APMC', minPrice: 900, maxPrice: 1650, modalPrice: 1310, date: '2026-11-22', changePct: 2.4 },
    { ...base, id: 'PRICE-sample05', crop: 'Grapes', state: 'Maharashtra', district: 'Nashik', mandi: 'Nashik APMC', minPrice: 3200, maxPrice: 5400, modalPrice: 4300, date: '2026-11-22', changePct: 1.1 },
    { ...base, id: 'PRICE-sample06', crop: 'Wheat', state: 'Punjab', district: 'Ludhiana', mandi: 'Khanna Mandi', minPrice: 2250, maxPrice: 2520, modalPrice: 2400, date: '2026-11-22', changePct: 0.2 },
  ];
}

/**
 * Simplified, illustrative summaries of well-known schemes. Rules are demo
 * approximations — users must verify everything at the official source.
 */
export function sampleSchemes(): Scheme[] {
  const ts = nowIso();
  const base = { dataType: 'sample' as const, lastUpdatedAt: ts, createdAt: ts, version: 1 };
  return [
    {
      ...base,
      id: 'SCHEME-sample01',
      name: 'PM-KISAN (sample summary)',
      category: 'Income support',
      state: 'All India',
      summary:
        'Illustrative summary: income support for eligible landholder farmer families, paid in instalments. Stored criteria are simplified demo rules — verify at the official portal.',
      eligibility: ['Landholder farmer family (demo rule)', 'Excludes higher-income categories (demo rule)'],
      eligibilityRules: [
        { field: 'landHoldingHa', op: 'gte', value: 0.01, description: 'Owns at least some cultivable land (demo approximation).' },
        { field: 'annualIncomeINR', op: 'lte', value: 200000, description: 'Annual income within the demo threshold (not the official rule set).' },
      ],
      documents: ['Aadhaar card', 'Land records', 'Bank passbook'],
      sourceLabel: 'Official PM-KISAN portal',
      sourceUrl: 'https://pmkisan.gov.in/',
      tags: ['income', 'central', 'sample'],
    },
    {
      ...base,
      id: 'SCHEME-sample02',
      name: 'PMFBY crop insurance (sample summary)',
      category: 'Insurance',
      state: 'All India',
      summary:
        'Illustrative summary: crop insurance against notified natural calamities, pests and diseases. Demo criteria only — confirm notified crops and seasons at the official portal.',
      eligibility: ['Farmer growing a notified crop in a notified area (demo rule)'],
      eligibilityRules: [
        { field: 'landHoldingHa', op: 'gte', value: 0, description: 'Open to farmer families incl. sharecroppers (demo approximation).' },
      ],
      documents: ['Aadhaar card', 'Land records / tenancy agreement', 'Bank passbook', 'Sowing certificate'],
      sourceLabel: 'Official PMFBY portal',
      sourceUrl: 'https://pmfby.gov.in/',
      tags: ['insurance', 'central', 'sample'],
    },
    {
      ...base,
      id: 'SCHEME-sample03',
      name: 'Kisan Credit Card (sample summary)',
      category: 'Credit',
      state: 'All India',
      summary:
        'Illustrative summary: short-term credit for cultivation and allied activities. Demo criteria only — terms are set by the issuing bank.',
      eligibility: ['Farmer aged 18–75 (demo rule)'],
      eligibilityRules: [
        { field: 'age', op: 'gte', value: 18, description: 'At least 18 years old (demo approximation).' },
        { field: 'age', op: 'lte', value: 75, description: 'Up to 75 years old (demo approximation).' },
      ],
      documents: ['Aadhaar card', 'PAN card', 'Land records', 'Passport photo'],
      sourceLabel: 'Official myscheme directory',
      sourceUrl: 'https://www.myscheme.gov.in/',
      tags: ['credit', 'central', 'sample'],
    },
    {
      ...base,
      id: 'SCHEME-sample04',
      name: 'Maharashtra drip irrigation subsidy (sample summary)',
      category: 'Subsidy',
      state: 'Maharashtra',
      summary:
        'Illustrative state-level summary: support for micro-irrigation adoption. Demo criteria only — verify the current scheme text with the state agriculture department.',
      eligibility: ['Farmer in Maharashtra (demo rule)', 'Small or marginal landholding (demo rule)'],
      eligibilityRules: [
        { field: 'state', op: 'eq', value: 'Maharashtra', description: 'Farm located in Maharashtra (demo rule).' },
        { field: 'landHoldingHa', op: 'lte', value: 2, description: 'Small/marginal holding up to 2 ha (demo approximation).' },
      ],
      documents: ['Aadhaar card', '7/12 land extract', 'Bank passbook', 'Quotation for drip system'],
      sourceLabel: 'Maharashtra agriculture department',
      sourceUrl: 'https://krishi.maharashtra.gov.in/',
      tags: ['subsidy', 'state', 'irrigation', 'sample'],
    },
  ];
}

export async function seedSampleData(repos: { mandi: MandiRepository; schemes: SchemeRepository }): Promise<void> {
  for (const price of sampleMandiPrices()) await repos.mandi.put(price);
  for (const scheme of sampleSchemes()) await repos.schemes.put(scheme);
}