import type { StorageStatus } from '../types'

export interface StorageThresholds {
  minTemp: number
  maxTemp: number
  maxHumidity: number
}

export const storageService = {
  evaluate(tempC: number, humidity: number, thresholds: StorageThresholds): StorageStatus {
    const tempBreach = tempC < thresholds.minTemp || tempC > thresholds.maxTemp
    const humidityBreach = humidity > thresholds.maxHumidity
    if (tempBreach && humidityBreach) return 'critical'
    if (tempBreach || humidityBreach) {
      const tempGap = Math.max(thresholds.minTemp - tempC, tempC - thresholds.maxTemp, 0)
      const humidityGap = Math.max(humidity - thresholds.maxHumidity, 0)
      return tempGap > 3 || humidityGap > 6 ? 'critical' : 'warning'
    }
    return 'normal'
  },

  statusMessage(status: StorageStatus) {
    if (status === 'critical') return 'Above demo safety threshold — inspect promptly'
    if (status === 'warning') return 'Approaching demo threshold — monitor closely'
    return 'Within configured demo thresholds'
  },

  summary(batches: { status: StorageStatus; quantityKg: number }[]) {
    return {
      total: batches.length,
      normal: batches.filter((batch) => batch.status === 'normal').length,
      warning: batches.filter((batch) => batch.status === 'warning').length,
      critical: batches.filter((batch) => batch.status === 'critical').length,
      quantity: batches.reduce((sum, batch) => sum + batch.quantityKg, 0),
    }
  },
}
