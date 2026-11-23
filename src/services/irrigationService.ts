import type { IrrigationInput, IrrigationRecommendation } from '../types'

const cropNeed: Record<string, number> = {
  Tomato: 1.05,
  Wheat: 0.9,
  Grapes: 0.72,
  Onion: 0.68,
  Rice: 1.35,
  Cotton: 0.95,
  Maize: 0.92,
  Potato: 0.86,
}

const stageFactor: Record<string, number> = {
  Seedling: 0.65,
  Vegetative: 0.9,
  Flowering: 1.15,
  'Fruit / grain formation': 1.2,
  Maturity: 0.55,
}

export const irrigationService = {
  recommend(input: IrrigationInput): IrrigationRecommendation {
    const hot = input.temperature >= 32
    const dryWeather = ['Hot & dry', 'Sunny', 'Partly cloudy'].includes(input.weather)
    const rainExpected = input.weather.toLowerCase().includes('rain')
    const moisture = Math.min(100, Math.max(0, input.moisture))
    const sandy = input.soilType.toLowerCase().includes('sandy')
    const need = (cropNeed[input.crop] ?? 0.9) * (stageFactor[input.stage] ?? 1)
    const threshold = sandy ? 40 : 34

    let action: IrrigationRecommendation['action'] = 'hold'
    if (moisture < threshold - 8 || (hot && dryWeather && moisture < threshold)) action = 'irrigate-now'
    else if (moisture < threshold + 8 && !rainExpected) action = 'schedule'

    const baseLitres = Math.round(4200 * need * (action === 'irrigate-now' ? 1 : action === 'schedule' ? 0.7 : 0.25))
    const waterLitres = Math.max(900, baseLitres)
    const durationMin = Math.round(waterLitres / 145)

    const reasoning = [
      `Simulated soil moisture is ${moisture}%. ${sandy ? 'Sandy soils drain faster, so the demo threshold is higher.' : 'The default demo threshold is 34% for this soil group.'}`,
      `${input.crop} at ${input.stage.toLowerCase()} stage has a relative water need of ${need.toFixed(2)}× in this demo model.`,
      rainExpected
        ? 'Rain is expected in the simulated weather context, so irrigation can be deferred.'
        : hot
          ? 'High simulated temperature increases evapotranspiration.'
          : 'Weather context does not indicate immediate rainfall.',
      `Soil type: ${input.soilType}.`,
    ]

    return {
      headline:
        action === 'irrigate-now'
          ? 'Irrigation suggested soon'
          : action === 'schedule'
            ? 'Schedule a lighter irrigation'
            : 'Hold irrigation for now',
      action,
      waterLitres,
      durationMin,
      bestWindow: action === 'hold' ? 'Reassess in 24 hours' : 'Early morning or late evening',
      reasoning,
      confidenceNote:
        'Demo recommendation derived only from the values you entered. Simulated sensor readings are not field measurements.',
    }
  },
}
