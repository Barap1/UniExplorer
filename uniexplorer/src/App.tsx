import { useState } from 'react';
import { MapContainer, TileLayer, ZoomControl, ScaleControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Data structure for our celestial bodies
const celestialBodies = {
  mars: {
    name: 'Mars',
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/MRO_CTX_Mosaic_Global_25m/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
    attribution: 'Imagery © NASA GIBS | MRO CTX Mosaic',
    maxZoom: 8,
  },
  moon: {
    name: 'Moon',
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/LRO_WAC_Mosaic_Global/default/2011-08-11/GoogleMapsCompatible_Level7/{z}/{y}/{x}.jpg',
    attribution: 'Imagery © NASA GIBS | LRO WAC Mosaic',
    maxZoom: 7,
  }
};

function App() {
  // State to track which celestial body is currently being viewed
  const [activeBody, setActiveBody] = useState(celestialBodies.mars);

  // Function to toggle between Mars and the Moon
  const switchBody = () => {
    setActiveBody(currentBody => 
      currentBody.name === 'Mars' ? celestialBodies.moon : celestialBodies.mars
    );
  };

  return (
    <div className="w-screen h-screen">
      <div className="relative h-full w-full">
        {/* The key prop is crucial here. It tells React to re-render the component when the body changes. */}
        <MapContainer
          key={activeBody.name}
          center={[0, 0]}
          zoom={2}
          minZoom={1}
          maxZoom={activeBody.maxZoom}
          className="h-full w-full"
          zoomControl={false}
          scrollWheelZoom
        >
          <TileLayer
            attribution={activeBody.attribution}
            url={activeBody.url}
            maxNativeZoom={activeBody.maxZoom}
            maxZoom={activeBody.maxZoom}
            noWrap
          />
          <ZoomControl position="topleft" />
          <ScaleControl position="bottomleft" />
        </MapContainer>

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

