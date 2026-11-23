import type { Container } from '../container';
import type { AuditEntry } from '../models/audit';
import { HEURISTIC_DISCLAIMER, type CropCase } from '../models/cropCase';
import type { Farm } from '../models/farm';
import type { MandiPrice } from '../models/mandi';
import type { Scheme } from '../models/scheme';
import type { Inspection, StorageBatch } from '../models/storage';
import type { UserAccount } from '../models/user';
import type { NotificationRecord, PlatformSettingsRecord } from '../models/workspace';
import { nowIso } from '../utils/ids';
import { sampleMandiPrices, sampleSchemes } from './sampleData';

export interface SeedOptions {
  /** 'missing' preserves user edits and only inserts absent seed records; 'reset' re-writes seed records. */
  mode?: 'missing' | 'reset';
}

export async function seedDemoPortalData(
  repos: Container['repos'],
  options: SeedOptions = {},
): Promise<{ inserted: number; skipped: number }> {
  const mode = options.mode ?? 'missing';
  const ts = nowIso();
  let inserted = 0;
  let skipped = 0;

  const mandiSource = 'Demo market dataset — sample only';
  const mandiPrices: MandiPrice[] = [
    ...sampleMandiPrices(),
    { id: 'm-01', crop: 'Tomato', state: 'Maharashtra', district: 'Nashik', mandi: 'Nashik APMC', minPrice: 1420, maxPrice: 2180, modalPrice: 1840, unit: 'INR/quintal', date: '2026-11-21', source: mandiSource, dataType: 'sample', changePct: 4.2, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: 'm-02', crop: 'Tomato', state: 'Maharashtra', district: 'Pune', mandi: 'Pune APMC', minPrice: 1360, maxPrice: 2020, modalPrice: 1710, unit: 'INR/quintal', date: '2026-11-21', source: mandiSource, dataType: 'sample', changePct: 2.1, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: 'm-03', crop: 'Tomato', state: 'Karnataka', district: 'Bengaluru', mandi: 'Yeshwanthpur APMC', minPrice: 1510, maxPrice: 2320, modalPrice: 1960, unit: 'INR/quintal', date: '2026-11-21', source: mandiSource, dataType: 'sample', changePct: -1.4, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: 'm-04', crop: 'Wheat', state: 'Maharashtra', district: 'Nashik', mandi: 'Nashik APMC', minPrice: 2280, maxPrice: 2710, modalPrice: 2510, unit: 'INR/quintal', date: '2026-11-21', source: mandiSource, dataType: 'sample', changePct: 0.8, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: 'm-05', crop: 'Wheat', state: 'Uttar Pradesh', district: 'Lucknow', mandi: 'Lucknow Mandi', minPrice: 2210, maxPrice: 2640, modalPrice: 2430, unit: 'INR/quintal', date: '2026-11-21', source: mandiSource, dataType: 'sample', changePct: 1.2, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: 'm-06', crop: 'Wheat', state: 'Madhya Pradesh', district: 'Indore', mandi: 'Indore APMC', minPrice: 2170, maxPrice: 2590, modalPrice: 2380, unit: 'INR/quintal', date: '2026-11-21', source: mandiSource, dataType: 'sample', changePct: -0.6, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: 'm-07', crop: 'Grapes', state: 'Maharashtra', district: 'Nashik', mandi: 'Nashik APMC', minPrice: 3850, maxPrice: 5420, modalPrice: 4680, unit: 'INR/quintal', date: '2026-11-20', source: mandiSource, dataType: 'sample', changePct: 3.4, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: 'm-08', crop: 'Grapes', state: 'Karnataka', district: 'Bengaluru', mandi: 'Yeshwanthpur APMC', minPrice: 3690, maxPrice: 5180, modalPrice: 4420, unit: 'INR/quintal', date: '2026-11-20', source: mandiSource, dataType: 'sample', changePct: 1.9, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: 'm-09', crop: 'Onion', state: 'Maharashtra', district: 'Nashik', mandi: 'Lasalgaon APMC', minPrice: 1180, maxPrice: 1760, modalPrice: 1490, unit: 'INR/quintal', date: '2026-11-21', source: mandiSource, dataType: 'sample', changePct: -2.8, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: 'm-10', crop: 'Onion', state: 'Telangana', district: 'Warangal', mandi: 'Warangal Market', minPrice: 1260, maxPrice: 1810, modalPrice: 1570, unit: 'INR/quintal', date: '2026-11-21', source: mandiSource, dataType: 'sample', changePct: 0.5, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: 'm-11', crop: 'Rice', state: 'Uttar Pradesh', district: 'Sultanpur', mandi: 'Sultanpur Mandi', minPrice: 2950, maxPrice: 3480, modalPrice: 3210, unit: 'INR/quintal', date: '2026-11-20', source: mandiSource, dataType: 'sample', changePct: 0.3, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: 'm-12', crop: 'Rice', state: 'Kerala', district: 'Palakkad', mandi: 'Palakkad Market', minPrice: 3120, maxPrice: 3650, modalPrice: 3390, unit: 'INR/quintal', date: '2026-11-20', source: mandiSource, dataType: 'sample', changePct: 1.1, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: 'm-13', crop: 'Cotton', state: 'Rajasthan', district: 'Barmer', mandi: 'Barmer Mandi', minPrice: 5120, maxPrice: 6180, modalPrice: 5640, unit: 'INR/quintal', date: '2026-11-19', source: mandiSource, dataType: 'sample', changePct: -0.9, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: 'm-14', crop: 'Maize', state: 'Telangana', district: 'Warangal', mandi: 'Warangal Market', minPrice: 1980, maxPrice: 2410, modalPrice: 2190, unit: 'INR/quintal', date: '2026-11-21', source: mandiSource, dataType: 'sample', changePct: 2.4, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: 'm-15', crop: 'Potato', state: 'Uttar Pradesh', district: 'Lucknow', mandi: 'Lucknow Mandi', minPrice: 1080, maxPrice: 1560, modalPrice: 1320, unit: 'INR/quintal', date: '2026-11-21', source: mandiSource, dataType: 'sample', changePct: -1.7, lastUpdatedAt: ts, createdAt: ts, version: 1 },
  ];
  for (const price of mandiPrices) {
    if (mode === 'missing' && (await repos.mandi.get(price.id))) {
      skipped++;
      continue;
    }
    await repos.mandi.put(price);
    inserted++;
  }

  const officialSource = 'https://www.india.gov.in/';
  const sourceLabel = 'Official India government information portal — verify current details';
  const schemes: Scheme[] = [
    ...sampleSchemes(),
    {
      id: 'scheme-01',
      name: 'Crop Insurance Awareness',
      category: 'Risk protection',
      state: 'All India',
      summary: 'Sample entry describing a crop insurance support theme. Check the official source for current scheme availability and terms.',
      eligibility: ['Applicable farmers as defined in the current official guidelines', 'Verify land and crop criteria on the official source'],
      eligibilityRules: [
        { field: 'landHoldingHa', op: 'gte', value: 0, description: 'Cultivates land (owner or tenant) under demo criteria.' },
      ],
      documents: ['Identity proof as specified', 'Land records if required by the scheme', 'Crop details and sowing evidence if requested'],
      sourceLabel,
      sourceUrl: officialSource,
      tags: ['insurance', 'risk', 'kharif'],
      dataType: 'sample',
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1,
    },
    {
      id: 'scheme-02',
      name: 'Irrigation Efficiency Support',
      category: 'Irrigation',
      state: 'All India',
      summary: 'Demo scheme entry focused on water-use efficiency and on-farm irrigation improvements. Confirm eligibility and benefits officially.',
      eligibility: ['Farmers meeting current official criteria', 'Confirm state-specific implementation through official sources'],
      eligibilityRules: [
        { field: 'landHoldingHa', op: 'gte', value: 0.2, description: 'Minimum 0.2 ha cultivable holding (demo threshold).' },
        { field: 'landHoldingHa', op: 'lte', value: 5, description: 'Up to 5 ha eligible area under micro-irrigation support (demo rule).' },
      ],
      documents: ['Land records if required', 'Identity proof as specified', 'Farm irrigation details if requested'],
      sourceLabel,
      sourceUrl: officialSource,
      tags: ['irrigation', 'water', 'drip'],
      dataType: 'sample',
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1,
    },
    {
      id: 'scheme-03',
      name: 'Soil Health Improvement Initiative',
      category: 'Soil & nutrients',
      state: 'All India',
      summary: 'Sample information for a soil-health theme. Soil testing and advisory components should be confirmed on official portals.',
      eligibility: ['Eligibility as published in current official guidelines'],
      eligibilityRules: [
        { field: 'landHoldingHa', op: 'gte', value: 0.01, description: 'Active farm plot registered for soil sampling (demo rule).' },
      ],
      documents: ['Land records if required', 'Soil test report if available'],
      sourceLabel,
      sourceUrl: officialSource,
      tags: ['soil', 'testing', 'fertility'],
      dataType: 'sample',
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1,
    },
    {
      id: 'scheme-04',
      name: 'Farm Mechanisation Access',
      category: 'Equipment',
      state: 'Maharashtra',
      summary: 'Demonstration entry for machinery access support. State implementation, quotas and terms must be verified officially.',
      eligibility: ['State-specific criteria as published officially'],
      eligibilityRules: [
        { field: 'state', op: 'eq', value: 'Maharashtra', description: 'Farm located in Maharashtra (demo rule).' },
        { field: 'annualIncomeINR', op: 'lte', value: 500000, description: 'Annual household income up to ₹5,00,000 (demo approximation).' },
      ],
      documents: ['Identity and residence proof as specified', 'Landholding proof if required'],
      sourceLabel,
      sourceUrl: officialSource,
      tags: ['equipment', 'machinery', 'maharashtra'],
      dataType: 'sample',
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1,
    },
    {
      id: 'scheme-05',
      name: 'Digital Mandi Enablement',
      category: 'Market access',
      state: 'All India',
      summary: 'Sample scheme concept around digital market participation. Confirm market linkage rules and support through official sources.',
      eligibility: ['Farmers registered under applicable state systems', 'Additional criteria as published officially'],
      eligibilityRules: [
        { field: 'age', op: 'gte', value: 18, description: 'Applicant age 18 or older (demo criterion).' },
      ],
      documents: ['Farmer registration details', 'Bank details if requested', 'Produce details'],
      sourceLabel,
      sourceUrl: officialSource,
      tags: ['mandi', 'market', 'digital'],
      dataType: 'sample',
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1,
    },
    {
      id: 'scheme-06',
      name: 'Organic Farming Transition Support',
      category: 'Sustainable farming',
      state: 'Kerala',
      summary: 'Demo entry highlighting organic transition themes. Certification, support and timelines must be verified on official sources.',
      eligibility: ['Current official eligibility conditions', 'State-specific registration if applicable'],
      eligibilityRules: [
        { field: 'state', op: 'eq', value: 'Kerala', description: 'Farm located in Kerala (demo rule).' },
        { field: 'landHoldingHa', op: 'lte', value: 4, description: 'Landholding up to 4 ha (demo approximation).' },
      ],
      documents: ['Land records if required', 'Certification documents if already available'],
      sourceLabel,
      sourceUrl: officialSource,
      tags: ['organic', 'sustainability', 'kerala'],
      dataType: 'sample',
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1,
    },
    {
      id: 'scheme-07',
      name: 'Post-Harvest Storage Assistance',
      category: 'Storage',
      state: 'All India',
      summary: 'Sample information for storage infrastructure support. Verify scheme availability and application process officially.',
      eligibility: ['Eligibility as defined in current official guidelines'],
      eligibilityRules: [
        { field: 'landHoldingHa', op: 'gte', value: 0.5, description: 'Minimum 0.5 ha landholding (demo threshold).' },
      ],
      documents: ['Land and crop records if required', 'Storage plan if requested'],
      sourceLabel,
      sourceUrl: officialSource,
      tags: ['storage', 'post-harvest', 'infrastructure'],
      dataType: 'sample',
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1,
    },
    {
      id: 'scheme-08',
      name: 'Farmer Skill Development',
      category: 'Training',
      state: 'Telangana',
      summary: 'Demo training-themed scheme entry. Training availability and schedules must be confirmed through official sources.',
      eligibility: ['As published in the current official notification'],
      eligibilityRules: [
        { field: 'state', op: 'eq', value: 'Telangana', description: 'Resident farmer in Telangana (demo rule).' },
        { field: 'age', op: 'gte', value: 18, description: 'Age 18 years or above (demo rule).' },
      ],
      documents: ['Identity proof as specified', 'Farmer registration details if available'],
      sourceLabel,
      sourceUrl: officialSource,
      tags: ['training', 'skills', 'telangana'],
      dataType: 'sample',
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1,
    },
  ];
  for (const scheme of schemes) {
    if (mode === 'missing' && (await repos.schemes.get(scheme.id))) {
      skipped++;
      continue;
    }
    await repos.schemes.put(scheme);
    inserted++;
  }

  const cropCases: CropCase[] = [
    {
      id: 'CASE-2401',
      farmerId: 'farmer-001',
      farmerName: 'Ramesh Patil',
      crop: 'Tomato',
      plantPart: 'Leaf',
      location: 'Nashik, Maharashtra',
      symptoms: 'Dark circular spots with yellow halo on older leaves.',
      imageUrl: '/sample-leaf.svg',
      status: 'expert_review',
      priority: 'high',
      reviewStatus: 'in_review',
      assignedExpertId: 'expert-001',
      aiAnalysis: {
        provider: 'heuristic',
        condition: 'Possible early blight',
        confidence: 78,
        uncertainty: 'High uncertainty: rule-based demo comparison.',
        alternatives: [
          { name: 'Leaf spot complex', confidence: 46 },
          { name: 'Nutrient stress', confidence: 21 },
        ],
        observedSymptoms: ['Irregular brown lesions', 'Yellow haloing', 'Older leaves affected first'],
        explanation:
          'The visual pattern is consistent with a fungal leaf spot group. This is a demo comparison against sample reference patterns, not a confirmed field diagnosis.',
        nextSteps: [
          'Isolate a few affected leaves and photograph them in daylight.',
          'Avoid overhead irrigation until a human expert reviews the case.',
          'Check recent weather and irrigation history for prolonged leaf wetness.',
        ],
        recommendExpert: true,
        verified: false,
        simulated: true,
        disclaimer: HEURISTIC_DISCLAIMER,
        analyzedAt: '2026-11-21T08:25:00.000Z',
      },
      expertReview: {
        reviewedBy: 'expert-001',
        reviewerName: 'Dr. Anjali Deshmukh',
        notes: 'Initial review started against submitted tomato symptoms.',
        guidance: '',
        status: 'in_review',
        reviewedAt: '2026-11-21T09:10:00.000Z',
      },
      createdAt: '2026-11-21T08:24:00.000Z',
      updatedAt: '2026-11-21T09:10:00.000Z',
      version: 1,
    },
    {
      id: 'CASE-2402',
      farmerId: 'farmer-002',
      farmerName: 'Sunita Devi',
      crop: 'Wheat',
      plantPart: 'Leaf',
      location: 'Sultanpur, Uttar Pradesh',
      symptoms: 'Orange pustules scattered on upper leaf surface.',
      imageUrl: '/sample-leaf.svg',
      status: 'new',
      priority: 'high',
      reviewStatus: 'pending',
      aiAnalysis: {
        provider: 'heuristic',
        condition: 'Possible rust disease',
        confidence: 71,
        uncertainty: 'Moderate-high uncertainty: field inspection required.',
        alternatives: [{ name: 'Leaf scorch', confidence: 33 }],
        observedSymptoms: ['Orange-brown pustules', 'Upper leaf surface', 'Patchy field distribution'],
        explanation: 'Colour and distribution may indicate a rust-group disease. Confirmation requires field observation and expert review.',
        nextSteps: ['Record the affected area size.', 'Note recent rain and humidity.', 'Share a close-up of the leaf underside.'],
        recommendExpert: true,
        verified: false,
        simulated: true,
        disclaimer: HEURISTIC_DISCLAIMER,
        analyzedAt: '2026-11-21T15:03:00.000Z',
      },
      createdAt: '2026-11-21T15:02:00.000Z',
      updatedAt: '2026-11-21T15:03:00.000Z',
      version: 1,
    },
    {
      id: 'CASE-2403',
      farmerId: 'farmer-001',
      farmerName: 'Ramesh Patil',
      crop: 'Grapes',
      plantPart: 'Fruit',
      location: 'Nashik, Maharashtra',
      symptoms: 'Small dark specks on berries near the bunch centre.',
      imageUrl: '/sample-leaf.svg',
      status: 'ai_review',
      priority: 'medium',
      reviewStatus: 'pending',
      aiAnalysis: {
        provider: 'heuristic',
        condition: 'Possible berry spot',
        confidence: 64,
        uncertainty: 'High uncertainty: overlapping fruit symptoms.',
        alternatives: [{ name: 'Anthracnose group', confidence: 39 }],
        observedSymptoms: ['Dark specks', 'Bunch interior affected', 'No visible mould'],
        explanation: 'Demo pattern match. Fruit symptoms can have several overlapping causes and should be reviewed by a specialist.',
        nextSteps: ['Capture a second image from a different angle.', 'Check bunch ventilation.', 'Record recent humidity.'],
        recommendExpert: true,
        verified: false,
        simulated: true,
        disclaimer: HEURISTIC_DISCLAIMER,
        analyzedAt: '2026-11-20T11:41:00.000Z',
      },
      createdAt: '2026-11-20T11:40:00.000Z',
      updatedAt: '2026-11-20T11:41:00.000Z',
      version: 1,
    },
    {
      id: 'CASE-2404',
      farmerId: 'farmer-001',
      farmerName: 'Ramesh Patil',
      crop: 'Onion',
      plantPart: 'Leaf',
      location: 'Nashik, Maharashtra',
      symptoms: 'Leaf tips turning yellow and drying.',
      imageUrl: '/sample-leaf.svg',
      status: 'resolved',
      priority: 'low',
      reviewStatus: 'completed',
      assignedExpertId: 'expert-001',
      aiAnalysis: {
        provider: 'heuristic',
        condition: 'Possible moisture or nutrient stress',
        confidence: 58,
        uncertainty: 'High uncertainty: abiotic factors likely.',
        alternatives: [{ name: 'Fungal leaf blight', confidence: 42 }],
        observedSymptoms: ['Tip yellowing', 'Dry leaf edges', 'No distinct lesions'],
        explanation: 'Generic leaf discolouration can be linked to water, nutrient or disease factors. More context improves this demo result.',
        nextSteps: ['Check soil moisture at root depth.', 'Review recent fertiliser schedule.', 'Photograph the whole plant.'],
        recommendExpert: false,
        verified: false,
        simulated: true,
        disclaimer: HEURISTIC_DISCLAIMER,
        analyzedAt: '2026-11-18T06:56:00.000Z',
      },
      expertReview: {
        reviewedBy: 'expert-002',
        reviewerName: 'Dr. Vikram Singh',
        notes: 'Image suggests abiotic stress. No disease-specific treatment recommended from the photo alone.',
        guidance: 'Verify irrigation uniformity and review soil test results through a local advisory centre.',
        confirmedCondition: 'Abiotic moisture stress',
        status: 'completed',
        reviewedAt: '2026-11-18T14:10:00.000Z',
      },
      createdAt: '2026-11-18T06:55:00.000Z',
      updatedAt: '2026-11-18T14:10:00.000Z',
      version: 1,
    },
    {
      id: 'CASE-2405',
      farmerId: 'farmer-005',
      farmerName: 'Imran Qureshi',
      crop: 'Cotton',
      plantPart: 'Leaf',
      location: 'Barmer, Rajasthan',
      symptoms: 'Curled leaves with sticky residue.',
      imageUrl: '/sample-leaf.svg',
      status: 'new',
      priority: 'high',
      reviewStatus: 'pending',
      aiAnalysis: {
        provider: 'heuristic',
        condition: 'Possible sucking pest activity',
        confidence: 69,
        uncertainty: 'Field scouting needed.',
        alternatives: [{ name: 'Viral curl complex', confidence: 37 }],
        observedSymptoms: ['Leaf curling', 'Sticky surface', 'Soft growth affected'],
        explanation: 'The combination of curling and residue may point to sucking pests, but field scouting is required.',
        nextSteps: ['Inspect the underside of leaves.', 'Count affected plants in five locations.', 'Request expert review.'],
        recommendExpert: true,
        verified: false,
        simulated: true,
        disclaimer: HEURISTIC_DISCLAIMER,
        analyzedAt: '2026-11-22T04:19:00.000Z',
      },
      createdAt: '2026-11-22T04:18:00.000Z',
      updatedAt: '2026-11-22T04:19:00.000Z',
      version: 1,
    },
    {
      id: 'CASE-2406',
      farmerId: 'farmer-006',
      farmerName: 'Lakshmi Nair',
      crop: 'Rice',
      plantPart: 'Leaf',
      location: 'Palakkad, Kerala',
      symptoms: 'Linear brown lesions along leaf edges.',
      imageUrl: '/sample-leaf.svg',
      status: 'resolved',
      priority: 'medium',
      reviewStatus: 'completed',
      assignedExpertId: 'expert-001',
      aiAnalysis: {
        provider: 'heuristic',
        condition: 'Possible leaf blight group',
        confidence: 73,
        uncertainty: 'Sample-based similarity only.',
        alternatives: [{ name: 'Brown spot group', confidence: 44 }],
        observedSymptoms: ['Linear lesions', 'Leaf margin affected', 'Older leaves more visible'],
        explanation: 'Sample-based pattern similarity only. Confirm with local field observations.',
        nextSteps: ['Record field wetness duration.', 'Photograph lesion margins.', 'Share affected area estimate.'],
        recommendExpert: true,
        verified: false,
        simulated: true,
        disclaimer: HEURISTIC_DISCLAIMER,
        analyzedAt: '2026-11-16T09:31:00.000Z',
      },
      expertReview: {
        reviewedBy: 'expert-003',
        reviewerName: 'Dr. Ravi Menon',
        notes: 'Lesion pattern observed. Recommended non-chemical monitoring first.',
        guidance: 'Maintain field records and consult a local extension officer before any intervention.',
        confirmedCondition: 'Possible bacterial leaf blight pattern',
        status: 'completed',
        reviewedAt: '2026-11-17T12:00:00.000Z',
      },
      createdAt: '2026-11-16T09:30:00.000Z',
      updatedAt: '2026-11-17T12:00:00.000Z',
      version: 1,
    },
  ];
  for (const cropCase of cropCases) {
    const exists = await repos.cases.get(cropCase.id);
    if (exists) {
      if (mode === 'reset') {
        await repos.cases.update({ ...cropCase, version: exists.version + 1 }, exists.version);
        inserted++;
      } else {
        skipped++;
      }
      continue;
    }
    await repos.cases.create(cropCase);
    inserted++;
  }

  const farm: Farm = {
    id: 'farm-001',
    farmerId: 'farmer-001',
    name: 'Patil Family Farm',
    location: 'Nashik, Maharashtra',
    areaHa: 6.4,
    soilType: 'Black cotton soil',
    irrigationType: 'Drip + canal',
    plots: [
      { id: 'plot-a', name: 'Plot A — North Field', areaHa: 2.1, crop: 'Tomato', growthStage: 'Flowering', soilMoisture: 32, lastIrrigated: '2026-11-20', status: 'healthy' },
      { id: 'plot-b', name: 'Plot B — East Field', areaHa: 1.8, crop: 'Wheat', growthStage: 'Vegetative', soilMoisture: 26, lastIrrigated: '2026-11-19', status: 'watch' },
      { id: 'plot-c', name: 'Plot C — Orchard', areaHa: 1.5, crop: 'Grapes', growthStage: 'Fruit / grain formation', soilMoisture: 41, lastIrrigated: '2026-11-21', status: 'healthy' },
      { id: 'plot-d', name: 'Plot D — Storage Field', areaHa: 1.0, crop: 'Onion', growthStage: 'Vegetative', soilMoisture: 22, lastIrrigated: '2026-11-17', status: 'attention' },
    ],
    createdAt: ts,
    updatedAt: ts,
    version: 1,
  };
  const existingFarm = await repos.farms.get(farm.id);
  if (!existingFarm) {
    await repos.farms.create(farm);
    inserted++;
  } else {
    skipped++;
  }

  const batches: Array<{ batch: StorageBatch; inspections: Inspection[] }> = [
    {
      batch: {
        id: 'batch-01',
        ownerId: 'farmer-001',
        code: 'GB-2401',
        crop: 'Onion',
        quantityKg: 12400,
        location: 'Warehouse A · Bay 2',
        thresholds: { minTempC: 12, maxTempC: 28, maxHumidity: 70 },
        currentReading: { tempC: 26.4, humidity: 68, source: 'simulated', recordedAt: '2026-11-20T09:00:00.000Z' },
        status: 'normal',
        createdAt: '2026-11-12T08:00:00.000Z',
        updatedAt: '2026-11-20T09:00:00.000Z',
        version: 1,
      },
      inspections: [
        { id: 'insp-01', batchId: 'batch-01', inspectorId: 'farmer-001', inspectorName: 'Ramesh Patil', notes: 'Ventilation checked. No visible spoilage.', condition: 'normal', createdAt: '2026-11-20T09:15:00.000Z' },
        { id: 'insp-02', batchId: 'batch-01', inspectorId: 'farmer-001', inspectorName: 'Ramesh Patil', notes: 'Routine inspection completed.', condition: 'normal', createdAt: '2026-11-15T10:00:00.000Z' },
      ],
    },
    {
      batch: {
        id: 'batch-02',
        ownerId: 'farmer-001',
        code: 'GB-2402',
        crop: 'Wheat',
        quantityKg: 18200,
        location: 'Warehouse A · Bay 4',
        thresholds: { minTempC: 10, maxTempC: 28, maxHumidity: 68 },
        currentReading: { tempC: 30.8, humidity: 72, source: 'simulated', recordedAt: '2026-11-21T07:00:00.000Z' },
        status: 'critical',
        createdAt: '2026-11-08T08:00:00.000Z',
        updatedAt: '2026-11-21T07:00:00.000Z',
        version: 1,
      },
      inspections: [
        { id: 'insp-03', batchId: 'batch-02', inspectorId: 'farmer-001', inspectorName: 'Ramesh Patil', notes: 'Temperature above demo threshold. Ventilation recommended.', condition: 'critical', createdAt: '2026-11-21T08:00:00.000Z' },
      ],
    },
    {
      batch: {
        id: 'batch-03',
        ownerId: 'farmer-001',
        code: 'GB-2403',
        crop: 'Grapes',
        quantityKg: 4600,
        location: 'Cold Store · Chamber 1',
        thresholds: { minTempC: 0, maxTempC: 6, maxHumidity: 92 },
        currentReading: { tempC: 4.2, humidity: 88, source: 'simulated', recordedAt: '2026-11-21T06:00:00.000Z' },
        status: 'normal',
        createdAt: '2026-11-18T08:00:00.000Z',
        updatedAt: '2026-11-21T06:00:00.000Z',
        version: 1,
      },
      inspections: [
        { id: 'insp-04', batchId: 'batch-03', inspectorId: 'farmer-004', inspectorName: 'Kavita Sharma', notes: 'Cold chain holding within range.', condition: 'normal', createdAt: '2026-11-21T09:00:00.000Z' },
      ],
    },
    {
      batch: {
        id: 'batch-04',
        ownerId: 'farmer-001',
        code: 'GB-2404',
        crop: 'Tomato',
        quantityKg: 3200,
        location: 'Farm Store · Room 1',
        thresholds: { minTempC: 12, maxTempC: 26, maxHumidity: 72 },
        currentReading: { tempC: 27.9, humidity: 74, source: 'simulated', recordedAt: '2026-11-20T14:00:00.000Z' },
        status: 'warning',
        createdAt: '2026-11-16T08:00:00.000Z',
        updatedAt: '2026-11-20T14:00:00.000Z',
        version: 1,
      },
      inspections: [
        { id: 'insp-05', batchId: 'batch-04', inspectorId: 'farmer-001', inspectorName: 'Ramesh Patil', notes: 'Humidity slightly above demo threshold.', condition: 'warning', createdAt: '2026-11-20T15:00:00.000Z' },
      ],
    },
    {
      batch: {
        id: 'batch-05',
        ownerId: 'farmer-001',
        code: 'GB-2405',
        crop: 'Potato',
        quantityKg: 9800,
        location: 'Warehouse B · Bay 1',
        thresholds: { minTempC: 4, maxTempC: 18, maxHumidity: 75 },
        currentReading: { tempC: 14.6, humidity: 64, source: 'simulated', recordedAt: '2026-11-19T12:00:00.000Z' },
        status: 'normal',
        createdAt: '2026-11-05T08:00:00.000Z',
        updatedAt: '2026-11-19T12:00:00.000Z',
        version: 1,
      },
      inspections: [
        { id: 'insp-06', batchId: 'batch-05', inspectorId: 'farmer-002', inspectorName: 'Sunita Devi', notes: 'Dark storage conditions maintained.', condition: 'normal', createdAt: '2026-11-19T13:00:00.000Z' },
      ],
    },
    {
      batch: {
        id: 'batch-06',
        ownerId: 'farmer-001',
        code: 'GB-2406',
        crop: 'Maize',
        quantityKg: 7600,
        location: 'Warehouse B · Bay 3',
        thresholds: { minTempC: 8, maxTempC: 27, maxHumidity: 70 },
        currentReading: { tempC: 25.1, humidity: 79, source: 'simulated', recordedAt: '2026-11-18T11:00:00.000Z' },
        status: 'warning',
        createdAt: '2026-11-10T08:00:00.000Z',
        updatedAt: '2026-11-18T11:00:00.000Z',
        version: 1,
      },
      inspections: [
        { id: 'insp-07', batchId: 'batch-06', inspectorId: 'farmer-003', inspectorName: 'Arjun Reddy', notes: 'Humidity trend needs observation.', condition: 'warning', createdAt: '2026-11-18T12:00:00.000Z' },
      ],
    },
  ];
  for (const entry of batches) {
    const existingBatch = await repos.storage.getBatch(entry.batch.id);
    if (!existingBatch) {
      await repos.storage.createBatch(entry.batch);
      for (const insp of entry.inspections) await repos.storage.addInspection(insp);
      inserted++;
    } else {
      skipped++;
    }
  }

  const existingAudits = await repos.audit.list({ limit: 5 });
  if (existingAudits.items.length === 0) {
    const auditEntries: AuditEntry[] = [
      { id: 'AUD-001', actorId: 'farmer-001', actorRole: 'farmer', action: 'crop_case.created', target: 'CASE-2401', details: { crop: 'Tomato' }, timestamp: '2026-11-21T08:24:00.000Z' },
      { id: 'AUD-002', actorId: 'expert-001', actorRole: 'expert', action: 'crop_case.expert_reviewed', target: 'CASE-2401', details: { reviewStatus: 'in_review' }, timestamp: '2026-11-21T09:10:00.000Z' },
      { id: 'AUD-003', actorId: 'farmer-001', actorRole: 'farmer', action: 'storage.inspection_added', target: 'batch-02', details: { condition: 'critical' }, timestamp: '2026-11-21T08:00:00.000Z' },
      { id: 'AUD-004', actorId: 'admin-001', actorRole: 'admin', action: 'mandi.dataset_seeded', target: 'Nashik APMC', details: { count: mandiPrices.length }, timestamp: '2026-11-21T06:00:00.000Z' },
    ];
    for (const entry of auditEntries) await repos.audit.put(entry);
    inserted += auditEntries.length;
  }

  const directoryProfiles: UserAccount[] = [
    { id: 'farmer-001', name: 'Ramesh Patil', email: 'ramesh@krishi360.in', role: 'farmer', location: 'Nashik, Maharashtra', phone: '+91 98•••••412', status: 'active', joinedAt: '2026-04-12', avatar: 'RP', createdAt: ts, updatedAt: ts, version: 1 },
    { id: 'farmer-002', name: 'Sunita Devi', email: 'sunita@krishi360.in', role: 'farmer', location: 'Sultanpur, Uttar Pradesh', phone: '+91 94•••••809', status: 'active', joinedAt: '2026-05-03', avatar: 'SD', createdAt: ts, updatedAt: ts, version: 1 },
    { id: 'expert-001', name: 'Dr. Anjali Deshmukh', email: 'anjali@krishi360.in', role: 'expert', location: 'Pune, Maharashtra', phone: '+91 98•••••118', status: 'active', joinedAt: '2026-03-10', avatar: 'AD', specialisation: 'Plant pathology', organisation: 'KRISHI360 Expert Advisory', createdAt: ts, updatedAt: ts, version: 1 },
    { id: 'expert-002', name: 'Dr. Vikram Singh', email: 'vikram@krishi360.in', role: 'expert', location: 'Lucknow, Uttar Pradesh', phone: '+91 94•••••730', status: 'active', joinedAt: '2026-03-19', avatar: 'VS', specialisation: 'Irrigation & soil health', organisation: 'KRISHI360 Expert Advisory', createdAt: ts, updatedAt: ts, version: 1 },
  ];
  for (const profile of directoryProfiles) {
    const existing = await repos.users.get(profile.id);
    if (!existing) {
      await repos.users.create(profile);
      inserted++;
    } else {
      skipped++;
    }
  }

  const existingNotifs = await repos.workspace.listNotifications({ limit: 5 });
  if (existingNotifs.items.length === 0) {
    const seedNotifs: NotificationRecord[] = [
      {
        id: 'NOTIF-001',
        title: 'Storage alert on GB-2402 (Wheat)',
        body: 'Warehouse A Bay 4 exceeded temperature threshold (30.8°C). Check ventilation.',
        severity: 'critical',
        audience: 'farmer',
        readBy: [],
        createdAt: '2026-11-21T07:05:00.000Z',
      },
      {
        id: 'NOTIF-002',
        title: 'New crop case queued for review',
        body: 'CASE-2402 (Wheat rust symptoms) is awaiting expert verification.',
        severity: 'warning',
        audience: 'expert',
        readBy: [],
        createdAt: '2026-11-21T15:05:00.000Z',
      },
      {
        id: 'NOTIF-003',
        title: 'Persistent database active',
        body: 'All farm, crop, mandi, storage, scheme, and audit records are persisted in the backend database.',
        severity: 'info',
        audience: 'all',
        readBy: [],
        createdAt: '2026-11-21T06:00:00.000Z',
      },
    ];
    for (const notif of seedNotifs) await repos.workspace.putNotification(notif);
    inserted += seedNotifs.length;
  }

  const existingSettings = await repos.workspace.getPlatformSettings();
  if (!existingSettings) {
    const defaultSettings: PlatformSettingsRecord = {
      id: 'global',
      language: 'English',
      notificationsEnabled: true,
      demoMode: true,
      compactTables: false,
      expertReviewSlaHours: 24,
      storageAlertTemp: 28,
      storageAlertHumidity: 70,
      updatedAt: ts,
      version: 1,
    };
    await repos.workspace.savePlatformSettings(defaultSettings);
    inserted++;
  }

  return { inserted, skipped };
}
