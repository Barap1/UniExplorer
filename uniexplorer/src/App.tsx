import { useEffect, useRef, useState } from 'react'

// Data structure using the stable USGS WMS mapping service
const celestialBodies = {
  mars: {
    name: 'Mars',
    baseUrl: 'https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_simp_cyl.map',
    layerName: 'MDIM21_color',
    attribution: 'USGS Astrogeology Science Center | Viking MDIM 2.1',
    maxZoom: 7,
  },
  moon: {
    name: 'Moon',
    baseUrl: 'https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/moon/moon_simp_cyl.map',
    layerName: 'LRO_WAC_GLOBAL',
    attribution: 'USGS Astrogeology Science Center | LRO WAC Mosaic',
    maxZoom: 8,
  },
}

function App() {
  const [activeBody, setActiveBody] = useState(celestialBodies.mars)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.TileLayer.WMS | null>(null)

  useEffect(() => {
    if (!(window as any).L) {
      console.error('Leaflet is not loaded!')
      return
    }
    const L = (window as any).L as typeof import('leaflet')

    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    if (mapContainerRef.current && !mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [0, 0],
        zoom: 2,
        minZoom: 1,
        zoomControl: false,
        crs: L.CRS.EPSG4326,
        maxBounds: [
          [-90, -180],
          [90, 180],
        ],
        worldCopyJump: false,
        maxBoundsViscosity: 1,
      })

      L.control.zoom({ position: 'topleft' }).addTo(map)
      L.control.scale({ position: 'bottomleft' }).addTo(map)

      mapInstanceRef.current = map
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    const L = (window as any).L as typeof import('leaflet')

    if (layerRef.current) {
      map.removeLayer(layerRef.current)
    }

    map.setMaxZoom(activeBody.maxZoom)

    const newLayer = L.tileLayer.wms(activeBody.baseUrl, {
      layers: activeBody.layerName,
      format: 'image/jpeg',
      transparent: false,
      attribution: activeBody.attribution,
      crs: L.CRS.EPSG4326,
      tileSize: 256,
      noWrap: true,
    })

    newLayer.addTo(map)
    newLayer.on('tileerror', (event) => {
      console.error('Tile load error', event)
    })
    layerRef.current = newLayer
  }, [activeBody])

  const switchBody = () => {
    setActiveBody((currentBody) =>
      currentBody.name === 'Mars' ? celestialBodies.moon : celestialBodies.mars,
    )
  }

  return (
    <div className="w-screen h-screen">
      <div className="relative h-full w-full">
        <div ref={mapContainerRef} className="h-full w-full" />

        <div className="pointer-events-auto absolute top-4 right-4 z-[1000] flex w-64 flex-col gap-3 rounded-lg bg-slate-900/70 p-4 text-white shadow-lg backdrop-blur">
          <h1 className="text-xl font-semibold">UniExplorer</h1>
          <p className="text-sm text-slate-300">Currently viewing: {activeBody.name}</p>
          <button
            onClick={switchBody}
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"
          >
            Switch to {activeBody.name === 'Mars' ? 'Moon' : 'Mars'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App