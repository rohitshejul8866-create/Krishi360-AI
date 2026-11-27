import { useCallback, useEffect, useState } from 'react'
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMapView,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps'
import type { MapMouseEvent } from '@vis.gl/react-google-maps'
import { ExternalLink, LocateFixed, MapPin, Navigation, Search } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim()
const ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio']
const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 }

export interface MapMarkerItem {
  id: string
  title: string
  subtitle?: string
  lat: number
  lng: number
  kind?: 'farm' | 'plot' | 'place'
  mapsUri?: string
}

interface PlaceSearchResult {
  id: string
  displayName: string
  formattedAddress: string
  lat: number
  lng: number
  googleMapsURI?: string
}

interface PlacesLibLike {
  Place?: {
    searchByText: (request: {
      textQuery: string
      fields: string[]
      maxResultCount?: number
      region?: string
    }) => Promise<{
      places: Array<{
        id?: string
        displayName?: string
        formattedAddress?: string
        location?: { lat: () => number; lng: () => number } | { lat: number; lng: number }
        googleMapsURI?: string
      }>
    }>
  }
}

function extractLatLng(
  loc: { lat: (() => number) | number; lng: (() => number) | number } | undefined,
): { lat: number; lng: number } | null {
  if (!loc) return null
  const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat
  const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }
  return { lat, lng }
}

function MarkerPin({
  item,
  selected,
  onSelect,
}: {
  item: MapMarkerItem
  selected: boolean
  onSelect: (id: string | null) => void
}) {
  const [markerRef, marker] = useAdvancedMarkerRef()

  const pinColors =
    item.kind === 'farm'
      ? { background: '#2F4830', borderColor: '#1B2E1C', glyphColor: '#E8F3E8' }
      : item.kind === 'place'
        ? { background: '#B45309', borderColor: '#78350F', glyphColor: '#FEF3C7' }
        : { background: '#5E8A60', borderColor: '#2F4830', glyphColor: '#FFFFFF' }

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: item.lat, lng: item.lng }}
        title={item.title}
        onClick={() => onSelect(selected ? null : item.id)}
      >
        <Pin
          background={pinColors.background}
          borderColor={pinColors.borderColor}
          glyphColor={pinColors.glyphColor}
          scale={item.kind === 'farm' ? 1.2 : 1.0}
        />
      </AdvancedMarker>
      {selected && marker ? (
        <InfoWindow anchor={marker} maxWidth={260} onCloseClick={() => onSelect(null)}>
          <div className="space-y-1.5 p-0.5 text-xs text-slate-900">
            <p className="font-bold text-slate-950">{item.title}</p>
            {item.subtitle ? <p className="text-[11px] text-slate-600">{item.subtitle}</p> : null}
            <p className="font-mono text-[10px] text-slate-500">
              {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
            </p>
            {item.mapsUri ? (
              <a
                href={item.mapsUri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 underline"
              >
                Open in Google Maps <ExternalLink size={11} />
              </a>
            ) : null}
          </div>
        </InfoWindow>
      ) : null}
    </>
  )
}

interface InnerMapProps {
  markers: MapMarkerItem[]
  defaultCenter?: { lat: number; lng: number }
  defaultZoom?: number
  selectionEnabled?: boolean
  onSelectCoordinates?: (coords: { lat: number; lng: number; label?: string }) => void
  enablePlaceSearch?: boolean
  searchPlaceholder?: string
  defaultSearchQuery?: string
  autoSearchNonce?: number
  onPlacesFound?: (places: PlaceSearchResult[]) => void
}

function KrishiMapCanvas({
  markers,
  defaultCenter,
  defaultZoom,
  selectionEnabled,
  onSelectCoordinates,
  enablePlaceSearch,
  searchPlaceholder,
  defaultSearchQuery = '',
  autoSearchNonce = 0,
  onPlacesFound,
}: InnerMapProps) {
  const map = useMap()
  const placesLib = useMapsLibrary('places') as unknown as PlacesLibLike | null
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState(defaultSearchQuery)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchMarkers, setSearchMarkers] = useState<MapMarkerItem[]>([])

  useEffect(() => {
    setSearchText(defaultSearchQuery)
  }, [defaultSearchQuery])

  const runPlaceSearch = useCallback(
    async (rawQuery: string) => {
      const q = rawQuery.trim()
      if (!q) return
      if (!placesLib?.Place?.searchByText) {
        setSearchError('Google Maps Places library is still loading. Try again in a moment.')
        return
      }
      setSearching(true)
      setSearchError('')
      try {
        const res = await placesLib.Place.searchByText({
          textQuery: q,
          fields: ['id', 'displayName', 'formattedAddress', 'location', 'googleMapsURI'],
          maxResultCount: 8,
          region: 'IN',
        })
        const found: PlaceSearchResult[] = []
        for (const place of res.places ?? []) {
          const coords = extractLatLng(place.location)
          if (!coords) continue
          found.push({
            id: place.id ?? `place-${found.length}-${coords.lat.toFixed(4)}`,
            displayName: place.displayName ?? 'Location',
            formattedAddress: place.formattedAddress ?? '',
            lat: coords.lat,
            lng: coords.lng,
            googleMapsURI: place.googleMapsURI,
          })
        }
        const mapped: MapMarkerItem[] = found.map((p) => ({
          id: p.id,
          title: p.displayName,
          subtitle: p.formattedAddress,
          lat: p.lat,
          lng: p.lng,
          kind: 'place',
          mapsUri: p.googleMapsURI,
        }))
        setSearchMarkers(mapped)
        onPlacesFound?.(found)
        if (found[0]) {
          map?.panTo({ lat: found[0].lat, lng: found[0].lng })
          map?.setZoom(11)
          setSelectedId(found[0].id)
          if (selectionEnabled && onSelectCoordinates) {
            onSelectCoordinates({
              lat: found[0].lat,
              lng: found[0].lng,
              label: found[0].formattedAddress || found[0].displayName,
            })
          }
        } else {
          setSearchError('No Google Maps results matched that search.')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/Quota|OverQuota|RESOURCE_EXHAUSTED|429|REQUEST_DENIED|ApiNotActivated/i.test(msg)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'))
        }
        setSearchError(msg || 'Unable to search places via Google Maps.')
      } finally {
        setSearching(false)
      }
    },
    [placesLib, map, onPlacesFound, selectionEnabled, onSelectCoordinates],
  )

  useEffect(() => {
    if (autoSearchNonce > 0 && defaultSearchQuery.trim() && placesLib?.Place?.searchByText) {
      void runPlaceSearch(defaultSearchQuery)
    }
  }, [autoSearchNonce, defaultSearchQuery, placesLib, runPlaceSearch])

  const handleMapClick = (event: MapMouseEvent) => {
    if (!selectionEnabled || !onSelectCoordinates) return
    const latLng = event.detail?.latLng
    if (!latLng) return
    onSelectCoordinates({ lat: latLng.lat, lng: latLng.lng })
  }

  const allMarkers = [...markers, ...searchMarkers]
  const resolvedCenter =
    defaultCenter ??
    (markers[0] ? { lat: markers[0].lat, lng: markers[0].lng } : INDIA_CENTER)
  const resolvedZoom = defaultZoom ?? (markers[0] ? 13 : 5)

  return (
    <div className="space-y-3">
      {enablePlaceSearch ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void runPlaceSearch(searchText)
                }
              }}
              placeholder={searchPlaceholder ?? 'Search village, APMC mandi, or district…'}
              className="pl-10"
              aria-label="Search Google Maps places"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={searching || !searchText.trim()}
            onClick={() => void runPlaceSearch(searchText)}
          >
            <Navigation size={14} /> {searching ? 'Searching…' : 'Search Maps'}
          </Button>
          {selectionEnabled && onSelectCoordinates ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (!navigator.geolocation) {
                  setSearchError('Browser geolocation is unavailable.')
                  return
                }
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const lat = pos.coords.latitude
                    const lng = pos.coords.longitude
                    map?.panTo({ lat, lng })
                    map?.setZoom(14)
                    onSelectCoordinates({ lat, lng })
                  },
                  () => setSearchError('Location permission denied. Click directly on the map instead.'),
                )
              }}
            >
              <LocateFixed size={14} /> Use GPS
            </Button>
          ) : null}
        </div>
      ) : null}

      {searchError ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          {searchError}
        </p>
      ) : null}

      <div className="h-[340px] w-full overflow-hidden rounded-2xl border border-line/80 bg-soft-sage/20">
        <GoogleMapView
          mapId="DEMO_MAP_ID"
          defaultCenter={resolvedCenter}
          defaultZoom={resolvedZoom}
          gestureHandling="greedy"
          onClick={handleMapClick}
          internalUsageAttributionIds={ATTRIBUTION_IDS}
        >
          {allMarkers.map((item) => (
            <MarkerPin
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onSelect={setSelectedId}
            />
          ))}
        </GoogleMapView>
      </div>
    </div>
  )
}

export interface KrishiFarmMapProps extends InnerMapProps {
  emptyApiKeyNote?: string
}

export function KrishiFarmMap({ emptyApiKeyNote, ...props }: KrishiFarmMapProps) {
  if (!MAPS_API_KEY) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-soft-sage/25 p-6 text-center">
        <MapPin size={24} className="text-forest" />
        <p className="mt-2 text-sm font-bold text-ink">Google Maps configuration pending</p>
        <p className="mt-1 max-w-md text-xs text-muted">
          {emptyApiKeyNote ??
            'Add VITE_GOOGLE_MAPS_API_KEY to your environment to enable interactive farm & mandi maps.'}
        </p>
      </div>
    )
  }

  return (
    <APIProvider
      apiKey={MAPS_API_KEY}
      libraries={['places', 'marker']}
      language="en"
      region="IN"
    >
      <KrishiMapCanvas {...props} />
    </APIProvider>
  )
}
