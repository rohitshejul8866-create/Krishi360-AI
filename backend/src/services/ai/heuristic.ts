import { HEURISTIC_DISCLAIMER, type AiAnalysis } from '../../models/cropCase';
import { nowIso } from '../../utils/ids';
import type { AiAnalysisService, AnalysisInput } from './types';

/**
 * Deterministic demo rules, mirroring the frontend's mock cropDoctorService.
 * ALWAYS labelled simulated. Intended for local development only — loadConfig
 * refuses AI_PROVIDER=heuristic inside Lambda.
 */

const KNOWLEDGE: Record<string, { condition: string; alternatives: string[]; symptoms: string[]; explanation: string }> = {
  Tomato: {
    condition: 'Possible early blight',
    alternatives: ['Leaf spot complex', 'Nutrient stress'],
    symptoms: ['Irregular brown lesions', 'Yellow haloing', 'Older leaves affected first'],
    explanation:
      'The described pattern resembles common tomato leaf-spot groups. Similar visual symptoms can come from different causes, so this is only a demo comparison.',
  },
  Wheat: {
    condition: 'Possible rust-group disease',
    alternatives: ['Leaf scorch', 'Nutrient imbalance'],
    symptoms: ['Small orange-brown pustules', 'Upper leaf surface', 'Patchy distribution'],
    explanation:
      'Colour and distribution may match a rust-group pattern in wheat. Field confirmation is necessary because several stresses look similar.',
  },
  Grapes: {
    condition: 'Possible fruit spot complex',
    alternatives: ['Anthracnose group', 'Surface blemish'],
    symptoms: ['Dark specks on fruit', 'Bunch interior affected', 'No visible mould'],
    explanation:
      'Fruit blemishes can arise from disease, moisture or handling. This demo result highlights possibilities without confirming a cause.',
  },
};

const DEFAULT_KNOWLEDGE = {
  condition: 'Possible leaf stress pattern',
  alternatives: ['Fungal leaf spot group', 'Environmental stress'],
  symptoms: ['Discoloured leaf area', 'Uneven pattern', 'Additional context needed'],
  explanation:
    'The input describes a non-specific visual pattern. This demo engine compares broad reference patterns and cannot confirm a condition.',
};

const SAFE_NEXT_STEPS = [
  'Photograph affected and healthy plant parts together in daylight.',
  'Record recent rainfall, humidity and irrigation timing.',
  'Request a human expert review before any intervention.',
];

export class HeuristicAnalysisService implements AiAnalysisService {
  readonly provider = 'heuristic' as const;
  readonly simulated = true;

  async analyze(input: AnalysisInput): Promise<AiAnalysis> {
    const knowledge = KNOWLEDGE[input.crop] ?? DEFAULT_KNOWLEDGE;
    const symptomBonus = input.symptoms.trim().length > 20 ? 6 : 0;
    const confidence = Math.min(82, 62 + symptomBonus + (input.imageKey ? 6 : 0));
    return {
      provider: this.provider,
      condition: knowledge.condition,
      confidence,
      uncertainty:
        'High uncertainty: rule-based demo comparison without image understanding. Several conditions share these symptoms.',
      alternatives: knowledge.alternatives.map((name, index) => ({
        name,
        confidence: Math.max(18, confidence - 24 - index * 14),
      })),
      observedSymptoms: [...knowledge.symptoms, ...(input.symptoms.trim() ? [input.symptoms.trim()] : [])],
      explanation: knowledge.explanation,
      nextSteps: SAFE_NEXT_STEPS,
      recommendExpert: true,
      verified: false,
      simulated: true,
      disclaimer: HEURISTIC_DISCLAIMER,
      analyzedAt: nowIso(),
    };
  }
}