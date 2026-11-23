import { DEMO_PRICE_TREND } from '../data/mandiPrices'
import type { MandiPrice } from '../types'
import { formatINR } from './utils'

export interface MandiFilters {
  crop: string
  state: string
  district: string
  query: string
}

export const mandiService = {
  filter(prices: MandiPrice[], filters: MandiFilters): MandiPrice[] {
    return prices.filter((row) => {
      const matchesCrop = filters.crop === 'All crops' || row.crop === filters.crop
      const matchesState = filters.state === 'All states' || row.state === filters.state
      const matchesDistrict = filters.district === 'All districts' || row.district === filters.district
      const query = filters.query.trim().toLowerCase()
      const matchesQuery =
        !query ||
        [row.crop, row.mandi, row.district, row.state].some((value) => value.toLowerCase().includes(query))
      return matchesCrop && matchesState && matchesDistrict && matchesQuery
    })
  },

  summary(rows: MandiPrice[]) {
    if (rows.length === 0) {
      return { min: 0, max: 0, modal: 0, average: 0, mandiCount: 0 }
    }
    const min = Math.min(...rows.map((row) => row.minPrice))
    const max = Math.max(...rows.map((row) => row.maxPrice))
    const modal = Math.round(rows.reduce((sum, row) => sum + row.modalPrice, 0) / rows.length)
    return { min, max, modal, average: modal, mandiCount: rows.length }
  },

  trend(crop: string) {
    const offset = crop === 'Tomato' ? 0 : crop === 'Wheat' ? 480 : crop === 'Onion' ? -320 : 120
    return DEMO_PRICE_TREND.map((point) => ({ ...point, price: Math.max(400, point.price + offset) }))
  },

  estimate(quantityQtl: number, pricePerQtl: number, transportCost: number) {
    const gross = quantityQtl * pricePerQtl
    const net = Math.max(0, gross - transportCost)
    return { gross, net, transportCost, formattedNet: formatINR(net) }
  },
}
