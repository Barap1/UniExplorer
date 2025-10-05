import { useState, useEffect, useRef } from 'react';

// NOTE: Leaflet 'L' and its CSS are loaded from the CDN in index.html.

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
  }
};

function App() {
  const [activeBody, setActiveBody] = useState(celestialBodies.mars);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const layerRef = useRef<any | null>(null);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    // Initialize map ONCE
    if (!mapInstanceRef.current) {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapContainerRef.current, {
        center: [0, 0],
        zoom: 1,
        minZoom: 1,
        zoomControl: false,
        // --- FIXES FOR PLANETARY MAPS ---
        crs: L.CRS.EPSG4326, // Use a simple cylindrical projection
        worldCopyJump: false, // **IMPORTANT: Prevent map repeating**
        maxBoundsViscosity: 1.0, // Make map bounds solid
      });

      // Set the solid boundaries for the map
      map.setMaxBounds([[-90, -180], [90, 180]]);

      mapInstanceRef.current = map;
      L.control.zoom({ position: 'topleft' }).addTo(map);
      L.control.scale({ position: 'bottomleft' }).addTo(map);
    }

    const map = mapInstanceRef.current;
    if (map) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
      map.setMaxZoom(activeBody.maxZoom);
      const newWmsLayer = L.tileLayer.wms(activeBody.baseUrl, {
        layers: activeBody.layerName,
        format: 'image/jpeg',
        transparent: false,
        attribution: activeBody.attribution,
        noWrap: true, // **IMPORTANT: Prevent tile repeating**
      }).addTo(map);
      layerRef.current = newWmsLayer;
    }
  }, [activeBody]);

  const switchBody = () => {
    setActiveBody(currentBody =>
      currentBody.name === 'Mars' ? celestialBodies.moon : celestialBodies.mars
    );
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
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
  )
}

export default App;

