import type { AnalysisInput, AnalysisResult, CropCase } from '../types'
import { apiClient, getAuthToken } from './apiClient'
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

type SupportedMimeType = 'image/jpeg' | 'image/png' | 'image/webp'

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Unable to read image file.'))
    reader.readAsDataURL(blob)
  })
}

function renderUrlToRasterBase64(src: string, outputType: 'image/jpeg' | 'image/png' = 'image/jpeg'): Promise<{ imageBase64: string; imageMimeType: SupportedMimeType }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const maxDim = 1280
      const width = img.naturalWidth || 800
      const height = img.naturalHeight || 600
      const scale = Math.min(1, maxDim / Math.max(width, height))
      const targetW = Math.max(1, Math.round(width * scale))
      const targetH = Math.max(1, Math.round(height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context unavailable for image processing.'))
        return
      }
      if (outputType === 'image/jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, targetW, targetH)
      }
      ctx.drawImage(img, 0, 0, targetW, targetH)
      const dataUrl = canvas.toDataURL(outputType, 0.86)
      const base64 = dataUrl.split(',')[1] ?? ''
      if (!base64) {
        reject(new Error('Unable to encode image for analysis.'))
        return
      }
      resolve({ imageBase64: base64, imageMimeType: outputType })
    }
    img.onerror = () => reject(new Error('Failed to load crop image for Gemini analysis.'))
    img.src = src
  })
}

async function encodeImageForAnalysis(
  file: File | null | undefined,
  imageUrl: string,
): Promise<{ imageBase64: string; imageMimeType: SupportedMimeType } | null> {
  if (file) {
    const supported: SupportedMimeType[] = ['image/jpeg', 'image/png', 'image/webp']
    if (supported.includes(file.type as SupportedMimeType) && file.size <= 2 * 1024 * 1024) {
      const dataUrl = await readBlobAsDataUrl(file)
      const base64 = dataUrl.split(',')[1] ?? ''
      if (base64) {
        return { imageBase64: base64, imageMimeType: file.type as SupportedMimeType }
      }
    }
    const objectUrl = URL.createObjectURL(file)
    try {
      return await renderUrlToRasterBase64(objectUrl, 'image/jpeg')
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }
  if (imageUrl && (imageUrl.startsWith('/') || imageUrl.startsWith('blob:'))) {
    try {
      return await renderUrlToRasterBase64(imageUrl, 'image/png')
    } catch {
      return null
    }
  }
  return null
}

export const cropDoctorService = {
  async analyzeWithBackend(
    input: AnalysisInput,
    farmerInfo?: { id: string; name: string },
  ): Promise<{ cropCase: CropCase; analysis: AnalysisResult; persistedInBackend: boolean }> {
    const safeUrl =
      input.imageUrl &&
      (input.imageUrl.startsWith('/') ||
        input.imageUrl.startsWith('http://') ||
        input.imageUrl.startsWith('https://') ||
        input.imageUrl.startsWith('blob:'))
        ? input.imageUrl.slice(0, 500)
        : '/sample-leaf.svg'

    const encodedImage = await encodeImageForAnalysis(input.imageFile, safeUrl)

    if (getAuthToken()) {
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
        encodedImage ?? {},
      )

      return {
        cropCase: mapCropCase(analyzed.data.case),
        analysis: mapAnalysisResult(analyzed.data.analysis),
        persistedInBackend: true,
      }
    }

    let analysis: AnalysisResult | null = null
    try {
      const res = await fetch(`${apiClient.baseUrl}/ai/crop-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop: input.crop,
          plantPart: input.plantPart,
          location: input.location,
          symptoms: input.symptoms.trim(),
          ...(encodedImage ?? {}),
        }),
      })
      const contentType = res.headers.get('content-type') ?? ''
      if (res.status !== 404 && contentType.includes('application/json')) {
        const json = (await res.json().catch(() => ({}))) as {
          data?: { analysis?: BackendAiAnalysis }
          error?: string | { message?: string }
        }
        if (res.ok && json.data?.analysis) {
          analysis = mapAnalysisResult(json.data.analysis)
        } else if (res.status === 400) {
          const msg = typeof json.error === 'string' ? json.error : json.error?.message
          throw new Error(msg || 'Invalid crop analysis input.')
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'Invalid crop analysis input.') {
        throw err
      }
    }

    if (!analysis) {
      const fallback = await cropDoctorService.analyze(input)
      analysis = {
        ...fallback,
        provider: 'heuristic',
        simulated: true,
        uncertainty:
          'Server AI endpoint unreachable on this host; saved indicative pattern analysis to your Cloud Firestore account.',
      }
    }

    const cropCase: CropCase = {
      id: makeId('CASE'),
      farmerId: farmerInfo?.id || 'firebase-user',
      farmerName: farmerInfo?.name || 'Farmer',
      crop: input.crop,
      plantPart: input.plantPart,
      location: input.location,
      symptoms: input.symptoms.trim(),
      imageUrl: safeUrl,
      condition: analysis.condition,
      confidence: analysis.confidence,
      alternatives: analysis.alternatives,
      observedSymptoms: analysis.observedSymptoms,
      explanation: analysis.explanation,
      nextSteps: analysis.nextSteps,
      recommendExpert: analysis.recommendExpert,
      provider: analysis.provider,
      modelId: analysis.modelId,
      uncertainty: analysis.uncertainty,
      simulated: analysis.simulated,
      status: 'ai_review',
      priority: input.symptoms.trim().length > 20 ? 'high' : 'medium',
      submittedAt: new Date().toISOString(),
      reviewStatus: 'pending',
    }

    return { cropCase, analysis, persistedInBackend: false }
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
