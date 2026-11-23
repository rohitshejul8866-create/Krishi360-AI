import type { MandiPrice } from '../types'

const source = 'Demo market dataset'

export const DEMO_MANDI_PRICES: MandiPrice[] = [
  { id: 'm-01', crop: 'Tomato', state: 'Maharashtra', district: 'Nashik', mandi: 'Nashik APMC', minPrice: 1420, maxPrice: 2180, modalPrice: 1840, date: '2026-11-21', source, changePct: 4.2 },
  { id: 'm-02', crop: 'Tomato', state: 'Maharashtra', district: 'Pune', mandi: 'Pune APMC', minPrice: 1360, maxPrice: 2020, modalPrice: 1710, date: '2026-11-21', source, changePct: 2.1 },
  { id: 'm-03', crop: 'Tomato', state: 'Karnataka', district: 'Bengaluru', mandi: 'Yeshwanthpur APMC', minPrice: 1510, maxPrice: 2320, modalPrice: 1960, date: '2026-11-21', source, changePct: -1.4 },
  { id: 'm-04', crop: 'Wheat', state: 'Maharashtra', district: 'Nashik', mandi: 'Nashik APMC', minPrice: 2280, maxPrice: 2710, modalPrice: 2510, date: '2026-11-21', source, changePct: 0.8 },
  { id: 'm-05', crop: 'Wheat', state: 'Uttar Pradesh', district: 'Lucknow', mandi: 'Lucknow Mandi', minPrice: 2210, maxPrice: 2640, modalPrice: 2430, date: '2026-11-21', source, changePct: 1.2 },
  { id: 'm-06', crop: 'Wheat', state: 'Madhya Pradesh', district: 'Indore', mandi: 'Indore APMC', minPrice: 2170, maxPrice: 2590, modalPrice: 2380, date: '2026-11-21', source, changePct: -0.6 },
  { id: 'm-07', crop: 'Grapes', state: 'Maharashtra', district: 'Nashik', mandi: 'Nashik APMC', minPrice: 3850, maxPrice: 5420, modalPrice: 4680, date: '2026-11-20', source, changePct: 3.4 },
  { id: 'm-08', crop: 'Grapes', state: 'Karnataka', district: 'Bengaluru', mandi: 'Yeshwanthpur APMC', minPrice: 3690, maxPrice: 5180, modalPrice: 4420, date: '2026-11-20', source, changePct: 1.9 },
  { id: 'm-09', crop: 'Onion', state: 'Maharashtra', district: 'Nashik', mandi: 'Lasalgaon APMC', minPrice: 1180, maxPrice: 1760, modalPrice: 1490, date: '2026-11-21', source, changePct: -2.8 },
  { id: 'm-10', crop: 'Onion', state: 'Telangana', district: 'Warangal', mandi: 'Warangal Market', minPrice: 1260, maxPrice: 1810, modalPrice: 1570, date: '2026-11-21', source, changePct: 0.5 },
  { id: 'm-11', crop: 'Rice', state: 'Uttar Pradesh', district: 'Sultanpur', mandi: 'Sultanpur Mandi', minPrice: 2950, maxPrice: 3480, modalPrice: 3210, date: '2026-11-20', source, changePct: 0.3 },
  { id: 'm-12', crop: 'Rice', state: 'Kerala', district: 'Palakkad', mandi: 'Palakkad Market', minPrice: 3120, maxPrice: 3650, modalPrice: 3390, date: '2026-11-20', source, changePct: 1.1 },
  { id: 'm-13', crop: 'Cotton', state: 'Rajasthan', district: 'Barmer', mandi: 'Barmer Mandi', minPrice: 5120, maxPrice: 6180, modalPrice: 5640, date: '2026-11-19', source, changePct: -0.9 },
  { id: 'm-14', crop: 'Maize', state: 'Telangana', district: 'Warangal', mandi: 'Warangal Market', minPrice: 1980, maxPrice: 2410, modalPrice: 2190, date: '2026-11-21', source, changePct: 2.4 },
  { id: 'm-15', crop: 'Potato', state: 'Uttar Pradesh', district: 'Lucknow', mandi: 'Lucknow Mandi', minPrice: 1080, maxPrice: 1560, modalPrice: 1320, date: '2026-11-21', source, changePct: -1.7 },
]

export const MANDI_STATES = Array.from(new Set(DEMO_MANDI_PRICES.map((row) => row.state))).sort()
export const MANDI_DISTRICTS = Array.from(new Set(DEMO_MANDI_PRICES.map((row) => row.district))).sort()

export const DEMO_PRICE_TREND = [
  { day: '15 Nov', price: 1690 },
  { day: '16 Nov', price: 1725 },
  { day: '17 Nov', price: 1705 },
  { day: '18 Nov', price: 1780 },
  { day: '19 Nov', price: 1810 },
  { day: '20 Nov', price: 1765 },
  { day: '21 Nov', price: 1840 },
]
