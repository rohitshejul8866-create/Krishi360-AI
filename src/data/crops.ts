import type { Crop } from '../types'

export const CROPS: Crop[] = [
  { id: 'crop-tomato', name: 'Tomato', category: 'Vegetable', season: 'Kharif / Rabi', durationDays: 110, waterNeed: 'medium', icon: 'tomato' },
  { id: 'crop-wheat', name: 'Wheat', category: 'Cereal', season: 'Rabi', durationDays: 120, waterNeed: 'medium', icon: 'wheat' },
  { id: 'crop-grapes', name: 'Grapes', category: 'Fruit', season: 'Year-round', durationDays: 240, waterNeed: 'low', icon: 'grape' },
  { id: 'crop-onion', name: 'Onion', category: 'Vegetable', season: 'Rabi', durationDays: 140, waterNeed: 'low', icon: 'onion' },
  { id: 'crop-rice', name: 'Rice', category: 'Cereal', season: 'Kharif', durationDays: 135, waterNeed: 'high', icon: 'rice' },
  { id: 'crop-cotton', name: 'Cotton', category: 'Cash crop', season: 'Kharif', durationDays: 180, waterNeed: 'medium', icon: 'cotton' },
  { id: 'crop-maize', name: 'Maize', category: 'Cereal', season: 'Kharif', durationDays: 105, waterNeed: 'medium', icon: 'maize' },
  { id: 'crop-potato', name: 'Potato', category: 'Vegetable', season: 'Rabi', durationDays: 100, waterNeed: 'medium', icon: 'potato' },
]

export const CROP_NAMES = CROPS.map((crop) => crop.name)

export const GROWTH_STAGES = [
  'Seedling',
  'Vegetative',
  'Flowering',
  'Fruit / grain formation',
  'Maturity',
]

export const PLANT_PARTS = ['Leaf', 'Stem', 'Fruit', 'Root', 'Whole plant']

export const SOIL_TYPES = ['Black cotton soil', 'Alluvial soil', 'Red soil', 'Laterite soil', 'Sandy loam']
