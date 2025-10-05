import { useCallback, useEffect, useRef, useState } from 'react'
import { auth, db } from './firebaseConfig'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'

// Leaflet assets are loaded globally via CDN in index.html

type LeafletModule = typeof import('leaflet')

type CelestialBodyKey = 'mars' | 'moon' | 'mercury'

interface CelestialBody {
  name: string
  baseUrl: string
  layerName: string
  attribution: string
  maxZoom: number
}

interface Annotation {
  id: string
  lat: number
  lng: number
  text: string
  author: string
  celestialBody: string
}

type ToastType = 'info' | 'error'

interface ToastMessage {
  id: number
  message: string
  type: ToastType
}

const celestialBodies: Record<CelestialBodyKey, CelestialBody> = {
  mars: {
    name: 'Mars',
    baseUrl: 'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.png',
    layerName: '',
    attribution: 'Mars basemap | USGS Astrogeology',
    maxZoom: 7,
  },
  moon: {
    name: 'Moon',
    baseUrl: 'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-moon-basemap-v0-1/all/{z}/{x}/{y}.png',
    layerName: '',
    attribution: 'Moon basemap | USGS Astrogeology',
    maxZoom: 7,
  },
  mercury: {
    name: 'Mercury',
    baseUrl: 'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mercury-basemap-v0-1/all/{z}/{x}/{y}.png',
    layerName: '',
    attribution: 'Mercury basemap | USGS Astrogeology',
    maxZoom: 7,
  },
}

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

function App() {
  const [activeBody, setActiveBody] = useState<CelestialBody>(celestialBodies.mars)
  const [user, setUser] = useState<User | null>(null)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const toastTimeoutsRef = useRef<Map<number, number>>(new Map())

  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((prev) => [...prev, { id, message, type }])

    const timeoutId = window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
      toastTimeoutsRef.current.delete(id)
    }, 4000)

    toastTimeoutsRef.current.set(id, timeoutId)
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
      toastTimeoutsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const L = (window as any).L as LeafletModule | undefined
    const container = mapContainerRef.current

    if (!L || !container) {
      return
    }

    container.replaceChildren()

    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    const map = L.map(container, {
      center: [0, 0],
      zoom: 2,
      minZoom: 1,
      zoomControl: false,
      crs: L.CRS.EPSG4326,
      worldCopyJump: false,
      maxBoundsViscosity: 1,
    })

    map.setMaxBounds([
      [-90, -180],
      [90, 180],
    ])
    map.setMaxZoom(activeBody.maxZoom)

    L.control.zoom({ position: 'topleft' }).addTo(map)
    L.control.scale({ position: 'bottomleft' }).addTo(map)

    const markers: L.Marker[] = []

    const tileLayer = L.tileLayer(activeBody.baseUrl, {
      attribution: activeBody.attribution,
      maxZoom: activeBody.maxZoom,
      tms: false,
      noWrap: true,
      bounds: [
        [-90, -180],
        [90, 180],
      ],
    }).addTo(map)

    let tileErrorShown = false

    tileLayer.on('tileerror', (event) => {
      console.error('Tile load error', event)
      if (!tileErrorShown) {
        showToast(
          `Tile load error for ${activeBody.name}. The imagery service may be temporarily unavailable.`,
          'error',
        )
        tileErrorShown = true
      }
    })

    map.fitBounds([
      [-90, -180],
      [90, 180],
    ])
    map.setView([0, 0], 2)
    window.setTimeout(() => map.invalidateSize(), 100)

    const annotationsQuery = query(
      collection(db, 'annotations'),
      where('celestialBody', '==', activeBody.name),
    )

    const unsubscribeAnnotations = onSnapshot(annotationsQuery, (snapshot) => {
      markers.forEach((marker) => marker.remove())
      markers.length = 0

      snapshot.forEach((doc) => {
        const data = doc.data()
        if (!data) {
          return
        }

        const annotation: Annotation = {
          id: doc.id,
          lat: data.lat,
          lng: data.lng,
          text: data.text ?? 'Unnamed discovery',
          author: data.author ?? 'Explorer',
          celestialBody: data.celestialBody ?? activeBody.name,
        }

        const marker = L.marker([annotation.lat, annotation.lng])
          .addTo(map)
          .bindPopup(`<strong>${annotation.text}</strong><br/>— ${annotation.author}`)

        markers.push(marker)
      })
    })

    map.on('click', async (event: L.LeafletMouseEvent) => {
      if (!auth.currentUser) {
        showToast('Please sign in to add a discovery tag.', 'info')
        return
      }

      const description = window.prompt('Describe your discovery:')?.trim()
      if (!description) {
        return
      }

      try {
        await addDoc(collection(db, 'annotations'), {
          lat: event.latlng.lat,
          lng: event.latlng.lng,
          text: description,
          author: auth.currentUser.displayName ?? 'Anonymous',
          celestialBody: activeBody.name,
          userId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
        })
        showToast('Discovery tag added!', 'info')
      } catch (error) {
        console.error('Failed to save annotation', error)
        showToast('Unable to save your discovery right now. Please try again.', 'error')
      }
    })

    return () => {
      unsubscribeAnnotations()
      markers.forEach((marker) => marker.remove())
      markers.length = 0
      map.off()
      map.remove()
    }
  }, [activeBody, showToast])

  const handleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const displayName = result.user.displayName ?? 'Explorer'
      showToast(`Welcome, ${displayName}!`, 'info')
    } catch (error) {
      console.error('Google sign-in failed', error)
      showToast('Google sign-in failed. Please try again.', 'error')
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      showToast('Signed out successfully.', 'info')
    } catch (error) {
      console.error('Sign out failed', error)
      showToast('Sign out failed. Please try again.', 'error')
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Top Navigation Bar */}
      <header className="relative z-[1000] bg-slate-900/80 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000"></div>
              <div className="relative w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl">🌌</span>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                UniExplorer
              </h1>
              <p className="text-xs text-slate-400">Planetary Exploration System</p>
            </div>
          </div>

          {/* Center Controls */}
          <div className="flex items-center gap-6">
            {/* Destination Selector */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="body-selector" className="text-xs font-semibold text-purple-300 uppercase tracking-wide">
                Destination
              </label>
              <select
                id="body-selector"
                value={activeBody.name}
                onChange={(e) => {
                  const selected = Object.values(celestialBodies).find(
                    (body) => body.name === e.target.value,
                  )
                  if (selected) setActiveBody(selected)
                }}
                className="px-4 py-2.5 bg-slate-800/50 backdrop-blur-sm border border-purple-500/30 rounded-lg text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all cursor-pointer hover:border-purple-500/50"
              >
                {Object.values(celestialBodies).map((body) => (
                  <option key={body.name} value={body.name}>
                    {body.name === 'Mars' ? '🔴' : body.name === 'Moon' ? '🌙' : '☿'} {body.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Badge */}
            <div className="hidden md:flex flex-col items-center gap-1 px-4 py-2 bg-slate-800/40 backdrop-blur-sm border border-white/10 rounded-lg">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-green-400">Active</span>
              </div>
            </div>
          </div>

          {/* User Section */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden md:block text-right">
                  <p className="text-sm font-semibold text-white">{user.displayName ?? 'Explorer'}</p>
                  <p className="text-xs text-purple-300">Authenticated</p>
                </div>
                {user.photoURL && (
                  <img 
                    src={user.photoURL} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full border-2 border-purple-500 shadow-lg"
                  />
                )}
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-red-200 text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-red-500/20"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={handleSignIn}
                className="group relative px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/50 hover:scale-105"
              >
                <span className="relative z-10">Sign in with Google</span>
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-400 to-pink-400 opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Map Container */}
        <div
          ref={mapContainerRef}
          className="absolute inset-0 w-full h-full"
        />

        {/* Left Sidebar - Mission Control */}
        <aside className="absolute left-6 top-6 bottom-6 w-80 bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[900] flex flex-col">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-white/10 bg-gradient-to-br from-purple-600/20 to-pink-600/20">
            <h2 className="text-lg font-bold text-white mb-1">Mission Control</h2>
            <p className="text-xs text-slate-300">Exploration Dashboard</p>
          </div>

          {/* Current Body Info */}
          <div className="p-6 space-y-4 flex-1 overflow-y-auto">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-3xl shadow-lg">
                  {activeBody.name === 'Mars' ? '🔴' : activeBody.name === 'Moon' ? '🌙' : '☿'}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">{activeBody.name}</h3>
                  <p className="text-xs text-purple-300">Current Target</p>
                </div>
              </div>
              
              <div className="space-y-2 pt-3 border-t border-white/10">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Max Zoom:</span>
                  <span className="text-white font-medium">{activeBody.maxZoom}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Projection:</span>
                  <span className="text-white font-medium">EPSG:4326</span>
                </div>
              </div>
            </div>

            {/* Interaction Status */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span className={user ? 'text-green-400' : 'text-yellow-400'}>●</span>
                Interaction Mode
              </h3>
              {user ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong className="text-white">Interactive Mode Active</strong><br />
                      Click anywhere on the map to place discovery markers and document your findings.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">!</span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong className="text-white">View-Only Mode</strong><br />
                      Sign in to unlock interactive features and collaborate with other explorers.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Features List */}
            <div className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20">
              <h3 className="text-sm font-semibold text-purple-300 mb-3 uppercase tracking-wide">Features</h3>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="text-purple-400">▪</span>
                  Real-time planetary imagery
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400">▪</span>
                  Collaborative annotations
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400">▪</span>
                  Multi-body exploration
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400">▪</span>
                  Cloud-synced discoveries
                </li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-slate-900/50">
            <p className="text-[10px] text-slate-500 text-center">
              Data: USGS Astrogeology • CartoCDN
            </p>
          </div>
        </aside>

        {/* Toast Notifications */}
        <div className="absolute bottom-6 right-6 z-[1100] flex flex-col gap-3 max-w-md">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="transform transition-all duration-300 ease-out"
              style={{
                animation: 'slideInRight 0.3s ease-out'
              }}
            >
              <div className={`
                flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl backdrop-blur-xl border
                ${toast.type === 'error' 
                  ? 'bg-red-500/90 border-red-400/50' 
                  : 'bg-purple-600/90 border-purple-400/50'
                }
              `}>
                <span className="text-2xl">
                  {toast.type === 'error' ? '⚠️' : '✨'}
                </span>
                <span className="text-white font-medium text-sm flex-1">{toast.message}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Global Styles */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        select {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23a78bfa' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
          background-position: right 0.5rem center;
          background-repeat: no-repeat;
          background-size: 1.5em 1.5em;
          padding-right: 2.5rem;
          appearance: none;
        }

        select option {
          background-color: #1e293b;
          color: white;
          padding: 0.5rem;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(147, 51, 234, 0.5);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(147, 51, 234, 0.7);
        }

        /* Leaflet controls styling */
        .leaflet-control-zoom {
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          background: rgba(15, 23, 42, 0.8) !important;
          backdrop-filter: blur(12px) !important;
          border-radius: 0.5rem !important;
          overflow: hidden;
        }

        .leaflet-control-zoom a {
          background: transparent !important;
          color: white !important;
          border: none !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        }

        .leaflet-control-zoom a:last-child {
          border-bottom: none !important;
        }

        .leaflet-control-zoom a:hover {
          background: rgba(147, 51, 234, 0.3) !important;
        }

        .leaflet-control-scale {
          background: rgba(15, 23, 42, 0.8) !important;
          backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 0.375rem !important;
          color: white !important;
        }

        .leaflet-control-scale-line {
          border: 2px solid rgba(147, 51, 234, 0.5) !important;
          border-top: none !important;
          color: white !important;
        }

        .leaflet-popup-content-wrapper {
          background: rgba(15, 23, 42, 0.95) !important;
          backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(147, 51, 234, 0.3) !important;
          border-radius: 0.75rem !important;
          color: white !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
        }

        .leaflet-popup-tip {
          background: rgba(15, 23, 42, 0.95) !important;
        }

        .leaflet-container a.leaflet-popup-close-button {
          color: rgba(255, 255, 255, 0.6) !important;
        }

        .leaflet-container a.leaflet-popup-close-button:hover {
          color: white !important;
        }
      `}</style>
    </div>
  )
}

export default App

