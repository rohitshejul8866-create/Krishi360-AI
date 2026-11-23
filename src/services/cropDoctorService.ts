import type { AnalysisInput, AnalysisResult, CropCase } from '../types'
import { apiClient } from './apiClient'
import {
  mapAnalysisResult,
  mapCropCase,
  type BackendAiAnalysis,
  type BackendCropCase,
} from './apiMappers'
import { delay, makeId } from './utils'

export const ANALYSIS_DISCLAIMER =
  'Demo AI analysis — not a verified agricultural diagnosis. Confirm with a qualified local expert before taking action.'

const KNOWLEDGE: Record<string, { condition: string; alternatives: string[]; symptoms: string[]; explanation: string; nextSteps: string[] }> = {
  Tomato: {
    condition: 'Possible early blight',
    alternatives: ['Leaf spot complex', 'Nutrient stress'],
    symptoms: ['Irregular brown lesions', 'Yellow haloing', 'Older leaves affected first'],
    explanation:
      'The uploaded sample pattern resembles common tomato leaf-spot groups. Similar visual symptoms can come from different causes, so this is only a demo comparison.',
    nextSteps: [
      'Photograph affected and healthy leaves together in daylight.',
      'Avoid wetting foliage until a human expert reviews the case.',
      'Record recent rainfall, humidity and irrigation timing.',
    ],
  },
  Wheat: {
    condition: 'Possible rust-group disease',
    alternatives: ['Leaf scorch', 'Nutrient imbalance'],
    symptoms: ['Small orange-brown pustules', 'Upper leaf surface', 'Patchy distribution'],
    explanation:
      'Colour and distribution may match a rust-group pattern in wheat. Field confirmation is necessary because several stresses look similar.',
    nextSteps: [
      'Note the number of affected plants across five field points.',
      'Photograph the leaf underside and stem.',
      'Ask a local expert to confirm before any intervention.',
    ],
  },
  Grapes: {
    condition: 'Possible fruit spot complex',
    alternatives: ['Anthracnose group', 'Surface blemish'],
    symptoms: ['Dark specks on fruit', 'Bunch interior affected', 'No visible mould'],
    explanation:
      'Fruit blemishes can arise from disease, moisture or handling. This demo result highlights possibilities without confirming a cause.',
    nextSteps: [
      'Capture close-ups from two angles.',
      'Check bunch airflow and moisture.',
      'Share the case with a horticulture expert.',
    ],
  },
}

const DEFAULT_KNOWLEDGE = {
  condition: 'Possible leaf stress pattern',
  alternatives: ['Fungal leaf spot group', 'Environmental stress'],
  symptoms: ['Discoloured leaf area', 'Uneven pattern', 'Additional context needed'],
  explanation:
    'The sample image shows a non-specific visual pattern. This demo engine compares broad reference patterns and cannot confirm a condition.',
  nextSteps: [
    'Add clearer symptoms and crop growth stage.',
    'Photograph the affected area from multiple distances.',
    'Request a human expert review for confidence.',
  ],
}

export const cropDoctorService = {
  async analyzeWithBackend(input: AnalysisInput): Promise<{ cropCase: CropCase; analysis: AnalysisResult }> {
    const safeUrl =
      input.imageUrl &&
      (input.imageUrl.startsWith('/') ||
        input.imageUrl.startsWith('http://') ||
        input.imageUrl.startsWith('https://') ||
        input.imageUrl.startsWith('blob:'))
        ? input.imageUrl.slice(0, 500)
        : '/sample-leaf.svg'

    const created = await apiClient.post<BackendCropCase>('/crop-cases', {
      crop: input.crop,
      plantPart: input.plantPart,
      location: input.location,
      symptoms: input.symptoms.trim(),
      imageUrl: safeUrl,
      priority: input.symptoms.trim().length > 20 ? 'high' : 'medium',
    })

    const analyzed = await apiClient.post<{ case: BackendCropCase; analysis: BackendAiAnalysis }>(
      `/crop-cases/${encodeURIComponent(created.data.id)}/analysis`,
      {},
    )

    return {
      cropCase: mapCropCase(analyzed.data.case),
      analysis: mapAnalysisResult(analyzed.data.analysis),
    }
  },

  async analyze(input: AnalysisInput): Promise<AnalysisResult> {
    await delay(1900)
    const knowledge = KNOWLEDGE[input.crop] ?? DEFAULT_KNOWLEDGE
    const symptomBonus = input.symptoms.trim().length > 20 ? 6 : 0
    const confidence = Math.min(82, 62 + symptomBonus + (input.imageUrl ? 6 : 0))

    return {
      condition: knowledge.condition,
      confidence,
      alternatives: knowledge.alternatives.map((name, index) => ({
        name,
        confidence: Math.max(18, confidence - 24 - index * 14),
      })),
      observedSymptoms: [...knowledge.symptoms, ...(input.symptoms.trim() ? [input.symptoms.trim()] : [])],
      explanation: knowledge.explanation,
      nextSteps: knowledge.nextSteps,
      recommendExpert: true,
      disclaimer: ANALYSIS_DISCLAIMER,
    }
  },

  createCase(input: AnalysisInput, result: AnalysisResult, farmerId: string, farmerName: string): CropCase {
    return {
      id: makeId('CASE'),
      farmerId,
      farmerName,
      crop: input.crop,
      plantPart: input.plantPart,
      location: input.location,
      symptoms: input.symptoms,
      imageUrl: input.imageUrl,
      condition: result.condition,
      confidence: result.confidence,
      alternatives: result.alternatives,
      observedSymptoms: result.observedSymptoms,
      explanation: result.explanation,
      nextSteps: result.nextSteps,
      recommendExpert: result.recommendExpert,
      status: 'new',
      priority: result.confidence >= 75 ? 'high' : 'medium',
      submittedAt: new Date().toISOString(),
      reviewStatus: 'pending',
    }
  },
}
