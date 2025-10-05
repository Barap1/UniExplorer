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

type CelestialBodyKey = 'mars' | 'moon'

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

const toastClasses: Record<ToastType, string> = {
  info: 'bg-slate-900/90 border border-slate-500 text-white',
  error: 'bg-red-600/90 border border-red-300 text-white',
}

const celestialBodies: Record<CelestialBodyKey, CelestialBody> = {
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

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

function App() {
  const [activeBody, setActiveBody] = useState<CelestialBody>(celestialBodies.mars)
  const [user, setUser] = useState<User | null>(null)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.TileLayer.WMS | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const activeBodyRef = useRef<CelestialBody>(activeBody)
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
    activeBodyRef.current = activeBody
  }, [activeBody])

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
    if (!L || !mapContainerRef.current || mapInstanceRef.current) {
      return
    }

    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    const map = L.map(mapContainerRef.current, {
      center: [0, 0],
      zoom: 1,
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
    map.fitBounds([
      [-90, -180],
      [90, 180],
    ])

    L.control.zoom({ position: 'topleft' }).addTo(map)
    L.control.scale({ position: 'bottomleft' }).addTo(map)

    map.on('click', async (event: L.LeafletMouseEvent) => {
      if (!auth.currentUser) {
        showToast('Please sign in to add a discovery tag.', 'info')
        return
      }

      const description = window.prompt('Describe your discovery:')?.trim()
      if (!description) {
        return
      }

      const currentBody = activeBodyRef.current

      try {
        await addDoc(collection(db, 'annotations'), {
          lat: event.latlng.lat,
          lng: event.latlng.lng,
          text: description,
          author: auth.currentUser.displayName ?? 'Anonymous',
          celestialBody: currentBody.name,
          userId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
        })
        showToast('Discovery tag added!', 'info')
      } catch (error) {
        console.error('Failed to save annotation', error)
        showToast('Unable to save your discovery right now. Please try again.', 'error')
      }
    })

    mapInstanceRef.current = map

    return () => {
      map.off()
      map.remove()
      mapInstanceRef.current = null
      layerRef.current = null
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
    }
  }, [])

  useEffect(() => {
    const L = (window as any).L as LeafletModule | undefined
    const map = mapInstanceRef.current
    if (!L || !map) {
      return
    }

    if (layerRef.current) {
      map.removeLayer(layerRef.current)
      layerRef.current = null
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

    newLayer.on('tileerror', (event) => {
      console.error('Tile load error', event)
    })

    newLayer.addTo(map)
    layerRef.current = newLayer

    map.fitBounds([
      [-90, -180],
      [90, 180],
    ])

    // --- FIX FOR MAP SWITCHING ---
    // Recenter the map and force it to recalculate its size
    map.setView([0, 0], 2)
    window.setTimeout(() => map.invalidateSize(), 100)
  }, [activeBody])

  useEffect(() => {
    const L = (window as any).L as LeafletModule | undefined
    const map = mapInstanceRef.current
    if (!L || !map) {
      return () => {}
    }

    const q = query(collection(db, 'annotations'), where('celestialBody', '==', activeBody.name))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []

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

        if (annotation.celestialBody !== activeBody.name) {
          return
        }

        const marker = L.marker([annotation.lat, annotation.lng])
          .addTo(map)
          .bindPopup(`<strong>${annotation.text}</strong><br/>— ${annotation.author}`)

        markersRef.current.push(marker)
      })
    })

    return () => {
      unsubscribe()
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
    }
  }, [activeBody])

  const switchBody = () => {
    setActiveBody((current) =>
      current.name === celestialBodies.mars.name ? celestialBodies.moon : celestialBodies.mars,
    )
  }

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
    <div
      className="relative h-screen w-screen"
      style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}
    >
      <div
        ref={mapContainerRef}
        className="h-full w-full"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      <div
        className="pointer-events-auto absolute top-4 right-4 z-[1000] flex w-72 flex-col gap-3 rounded-lg bg-slate-900/70 p-4 text-white shadow-lg backdrop-blur"
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          width: '18rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          backgroundColor: 'rgba(15, 23, 42, 0.78)',
          borderRadius: '0.75rem',
          padding: '1rem',
          color: '#fff',
          boxShadow: '0 20px 45px rgba(15, 23, 42, 0.35)',
          backdropFilter: 'blur(6px)',
          pointerEvents: 'auto',
          zIndex: 1000,
        }}
      >
        <h1 className="text-xl font-semibold">UniExplorer</h1>
        <p className="text-sm text-slate-300">Currently viewing: {activeBody.name}</p>

        {user ? (
          <div className="space-y-2">
            <p className="truncate text-sm">Welcome, {user.displayName ?? 'Explorer'}</p>
            <button
              onClick={handleSignOut}
              className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              Sign Out
            </button>
            <p className="text-xs text-slate-400">Click anywhere on the map to add a discovery tag.</p>
          </div>
        ) : (
          <button
            onClick={handleSignIn}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            Sign in with Google
          </button>
        )}

        <button
          onClick={switchBody}
          className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"
        >
          Switch to {activeBody.name === 'Mars' ? 'Moon' : 'Mars'}
        </button>
      </div>

      <div
        className="pointer-events-none absolute bottom-4 left-1/2 z-[1100] flex -translate-x-1/2 flex-col gap-2"
        style={{
          position: 'absolute',
          bottom: '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          alignItems: 'center',
          zIndex: 1100,
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[240px] rounded-md px-4 py-3 text-sm shadow-lg backdrop-blur ${toastClasses[toast.type]}`}
            style={{
              pointerEvents: 'auto',
              minWidth: '240px',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              fontSize: '0.9rem',
              color: '#fff',
              boxShadow: '0 18px 38px rgba(15, 23, 42, 0.35)',
              backdropFilter: 'blur(6px)',
              backgroundColor:
                toast.type === 'error' ? 'rgba(220, 38, 38, 0.85)' : 'rgba(30, 41, 59, 0.85)',
              border: toast.type === 'error' ? '1px solid rgba(254, 226, 226, 0.6)' : '1px solid rgba(148, 163, 184, 0.6)',
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App

