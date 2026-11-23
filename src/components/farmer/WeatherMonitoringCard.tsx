import { useState, useEffect } from 'react'
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSun,
  Wind,
  Droplets,
  Thermometer,
  RefreshCw,
  MapPin,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Sunrise,
  Sunset,
} from 'lucide-react'
import { Card, CardHeader } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { DEMO_FARM } from '../../data/farmers'
import { DEMO_WEATHER } from '../../data/irrigation'

interface WeatherData {
  temp: number
  feelsLike: number
  humidity: number
  rainProbability: number
  windSpeed: number
  conditionText: string
  weatherCode: number
  isLive: boolean
  daily: Array<{
    date: string
    dayName: string
    maxTemp: number
    minTemp: number
    rainProb: number
    weatherCode: number
  }>
  sunrise?: string
  sunset?: string
}

function getWeatherDetails(code: number): { text: string; icon: any } {
  // WMO Weather interpretation codes (Open-Meteo)
  if (code === 0) return { text: 'Clear sky', icon: Sun }
  if (code >= 1 && code <= 3) return { text: 'Partly cloudy', icon: CloudSun }
  if (code >= 45 && code <= 48) return { text: 'Foggy / Misty', icon: Cloud }
  if (code >= 51 && code <= 67) return { text: 'Light rain / Drizzle', icon: CloudRain }
  if (code >= 71 && code <= 77) return { text: 'Snow / Sleet', icon: Cloud }
  if (code >= 80 && code <= 82) return { text: 'Rain showers', icon: CloudRain }
  if (code >= 95) return { text: 'Thunderstorm', icon: CloudRain }
  return { text: 'Partly cloudy', icon: CloudSun }
}

export function WeatherMonitoringCard() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [errorNotice, setErrorNotice] = useState<string | null>(null)

  const fetchWeather = async () => {
    setLoading(true)
    setErrorNotice(null)
    try {
      // Nashik coordinates from DEMO_FARM location
      const lat = 19.9975
      const lon = 73.7898
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset&timezone=auto`

      const res = await fetch(url)
      if (!res.ok) throw new Error('Weather API network response was not ok')
      const data = await res.json()

      const current = data.current
      const dailyData = data.daily

      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const formattedDaily = dailyData.time.slice(0, 5).map((timeStr: string, idx: number) => {
        const d = new Date(timeStr)
        const dayName = idx === 0 ? 'Today' : daysOfWeek[d.getDay()]
        return {
          date: timeStr,
          dayName,
          maxTemp: Math.round(dailyData.temperature_2m_max[idx]),
          minTemp: Math.round(dailyData.temperature_2m_min[idx]),
          rainProb: dailyData.precipitation_probability_max?.[idx] ?? 15,
          weatherCode: dailyData.weather_code[idx],
        }
      })

      const sunriseStr = dailyData.sunrise?.[0] ? new Date(dailyData.sunrise[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '06:20 AM'
      const sunsetStr = dailyData.sunset?.[0] ? new Date(dailyData.sunset[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '06:15 PM'

      const code = current.weather_code ?? 1
      const info = getWeatherDetails(code)

      setWeather({
        temp: Math.round(current.temperature_2m),
        feelsLike: Math.round(current.apparent_temperature),
        humidity: current.relative_humidity_2m,
        rainProbability: formattedDaily[0]?.rainProb ?? 20,
        windSpeed: Math.round(current.wind_speed_10m ?? 10),
        conditionText: info.text,
        weatherCode: code,
        isLive: true,
        daily: formattedDaily,
        sunrise: sunriseStr,
        sunset: sunsetStr,
      })
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    } catch (err) {
      // Fallback to simulated demo weather
      console.warn('Live weather fetch failed, using realistic agricultural model:', err)
      setErrorNotice('Using simulated regional telemetry (Live weather API offline)')
      setWeather({
        temp: DEMO_WEATHER.temperatureC,
        feelsLike: DEMO_WEATHER.temperatureC + 2,
        humidity: DEMO_WEATHER.humidityPct,
        rainProbability: 25,
        windSpeed: DEMO_WEATHER.windKmh,
        conditionText: DEMO_WEATHER.condition,
        weatherCode: 2,
        isLive: false,
        sunrise: '06:22 AM',
        sunset: '06:14 PM',
        daily: [
          { date: '2026-11-23', dayName: 'Today', maxTemp: 31, minTemp: 18, rainProb: 25, weatherCode: 2 },
          { date: '2026-11-24', dayName: 'Mon', maxTemp: 30, minTemp: 17, rainProb: 10, weatherCode: 1 },
          { date: '2026-11-25', dayName: 'Tue', maxTemp: 29, minTemp: 16, rainProb: 40, weatherCode: 61 },
          { date: '2026-11-26', dayName: 'Wed', maxTemp: 28, minTemp: 17, rainProb: 15, weatherCode: 2 },
          { date: '2026-11-27', dayName: 'Thu', maxTemp: 32, minTemp: 19, rainProb: 5, weatherCode: 0 },
        ],
      })
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWeather()
  }, [])

  const currentWeatherInfo = weather ? getWeatherDetails(weather.weatherCode) : { text: 'Partly cloudy', icon: CloudSun }
  const CurrentIcon = currentWeatherInfo.icon

  // Generate advisory based on weather
  let advisory = 'Optimal conditions for crop monitoring and scheduled irrigation.'
  if (weather) {
    if (weather.rainProbability > 50) {
      advisory = 'High rainfall probability expected. Postpone fertilizer application and ensure farm drainage is clear.'
    } else if (weather.humidity > 80) {
      advisory = 'High atmospheric humidity (>80%). Monitor crops closely for fungal indicators or blight symptoms.'
    } else if (weather.temp > 35) {
      advisory = 'High daytime temperature. Ensure adequate moisture in drip-irrigated plots (Plots A & C).'
    } else if (weather.windSpeed > 20) {
      advisory = 'Strong wind gusts detected. Avoid pesticide spraying until winds subside.'
    }
  }

  return (
    <Card className="overflow-hidden border-sage/40 bg-gradient-to-br from-white via-soft-sage/20 to-white shadow-lg">
      <CardHeader
        title="Real-Time Farm Weather Intelligence"
        description={`Live meteorological telemetry for ${DEMO_FARM.name} (${DEMO_FARM.location})`}
        icon={<Sun className="text-amber-600 animate-pulse" size={20} />}
        action={
          <div className="flex items-center gap-2">
            {weather?.isLive ? (
              <Badge tone="success" className="gap-1 font-bold text-[11px]">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping" /> Live API
              </Badge>
            ) : (
              <Badge tone="warning" className="text-[11px]">Simulated Data</Badge>
            )}
            <button
              onClick={fetchWeather}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white/80 px-3 py-1.5 text-xs font-bold text-forest shadow-xs hover:bg-sage/10 transition"
              title="Refresh weather data"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        }
      />

      {errorNotice && (
        <div className="mx-6 mb-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-center justify-between">
          <span>{errorNotice}</span>
          <span className="text-[10px] text-amber-600 font-bold">Auto-fallback active</span>
        </div>
      )}

      {loading && !weather ? (
        <div className="flex h-48 items-center justify-center p-6 text-xs text-muted">
          <RefreshCw className="mr-2 animate-spin text-forest" size={16} /> Fetching live meteorological data for Nashik...
        </div>
      ) : weather ? (
        <div className="p-6 pt-2 space-y-6">
          {/* Main Current Weather Hero */}
          <div className="grid gap-6 rounded-3xl bg-forest p-6 text-white shadow-md sm:grid-cols-3 sm:items-center">
            <div className="flex items-center gap-4 sm:col-span-2">
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md">
                <CurrentIcon size={46} className="text-amber-300 drop-shadow-md" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-sage/90">{weather.conditionText}</span>
                  <span className="text-xs text-white/70">· Updated {lastUpdated}</span>
                </div>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold tracking-tight sm:text-5xl">{weather.temp}°C</span>
                  <span className="text-xs text-white/80">Feels like {weather.feelsLike}°C</span>
                </div>
                <p className="mt-2 text-xs text-sage/90 flex items-center gap-1">
                  <MapPin size={13} /> {DEMO_FARM.location} (19.99° N, 73.79° E)
                </p>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 border-t border-white/15 pt-4 sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0">
              <div className="text-center sm:text-left">
                <p className="text-[10px] font-bold tracking-wider text-sage/80 uppercase flex items-center justify-center sm:justify-start gap-1">
                  <Droplets size={12} /> Humidity
                </p>
                <p className="mt-1 text-lg font-extrabold">{weather.humidity}%</p>
                <p className="text-[10px] text-white/60">Optimal</p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-[10px] font-bold tracking-wider text-sage/80 uppercase flex items-center justify-center sm:justify-start gap-1">
                  <CloudRain size={12} /> Rain Prob
                </p>
                <p className="mt-1 text-lg font-extrabold">{weather.rainProbability}%</p>
                <p className="text-[10px] text-white/60">{weather.rainProbability > 40 ? 'High chance' : 'Low risk'}</p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-[10px] font-bold tracking-wider text-sage/80 uppercase flex items-center justify-center sm:justify-start gap-1">
                  <Wind size={12} /> Wind
                </p>
                <p className="mt-1 text-lg font-extrabold">{weather.windSpeed} km/h</p>
                <p className="text-[10px] text-white/60">Breezy</p>
              </div>
            </div>
          </div>

          {/* Sunrise / Sunset bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/70 border border-line/70 px-4 py-3 text-xs text-ink font-semibold">
            <div className="flex items-center gap-2">
              <Sunrise size={16} className="text-amber-500" />
              <span>Sunrise: <strong>{weather.sunrise}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Sunset size={16} className="text-orange-500" />
              <span>Sunset: <strong>{weather.sunset}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Thermometer size={16} className="text-forest" />
              <span>Soil Thermal Index: <strong>Normal (24°C)</strong></span>
            </div>
          </div>

          {/* 5-Day Forecast */}
          <div>
            <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-muted">5-Day Meteorological Forecast & Rain Probability</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {weather.daily.map((day) => {
                const dayInfo = getWeatherDetails(day.weatherCode)
                const DayIcon = dayInfo.icon
                return (
                  <div key={day.date} className="rounded-2xl border border-line/80 bg-white/80 p-3.5 text-center shadow-xs hover:border-sage transition">
                    <p className="text-xs font-extrabold text-ink">{day.dayName}</p>
                    <p className="text-[10px] text-muted">{day.date.slice(5)}</p>
                    <div className="my-2.5 flex justify-center text-forest">
                      <DayIcon size={26} className="text-sage" />
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs font-extrabold">
                      <span className="text-ink flex items-center"><ArrowUp size={11} className="text-red-500" />{day.maxTemp}°</span>
                      <span className="text-muted flex items-center"><ArrowDown size={11} className="text-blue-500" />{day.minTemp}°</span>
                    </div>
                    <div className="mt-2.5 rounded-xl bg-soft-sage/40 px-2 py-1 text-[11px] font-bold text-forest flex items-center justify-center gap-1">
                      <CloudRain size={11} className="text-blue-600" /> {day.rainProb}% rain
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Agri Weather Advisory Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-soft-sage/60 to-soft-sage/20 border border-sage/30 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-forest p-2 text-white">
                <Sparkles size={16} />
              </div>
              <div>
                <p className="text-xs font-extrabold text-forest uppercase tracking-wider">Agronomist Weather Advisory</p>
                <p className="mt-1 text-xs font-semibold text-ink leading-relaxed">{advisory}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
