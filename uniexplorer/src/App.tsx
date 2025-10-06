import { useCallback, useEffect, useRef, useState } from 'react'
import { auth, db } from './firebaseConfig'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'

type LeafletModule = typeof import('leaflet')

interface CelestialBody {
  name: string
  baseUrl: string
  attribution: string
  maxZoom: number
  emoji: string
}

interface Annotation {
  id: string
  lat: number
  lng: number
  text: string
  author: string
  celestialBody: string
}

const celestialBodies: Record<string, CelestialBody> = {
  mars: {
    name: 'Mars',
    baseUrl: 'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.png',
    attribution: 'USGS Astrogeology',
    maxZoom: 7,
    emoji: '🔴'
  },
  moon: {
    name: 'Moon',
    baseUrl: 'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-moon-basemap-v0-1/all/{z}/{x}/{y}.png',
    attribution: 'USGS Astrogeology',
    maxZoom: 7,
    emoji: '🌙'
  },
  mercury: {
    name: 'Mercury',
    baseUrl: 'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mercury-basemap-v0-1/all/{z}/{x}/{y}.png',
    attribution: 'USGS Astrogeology',
    maxZoom: 7,
    emoji: '☿'
  },
}

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

function App() {
  const [activeBody, setActiveBody] = useState<CelestialBody>(celestialBodies.mars)
  const [user, setUser] = useState<User | null>(null)
  const [toast, setToast] = useState<string>('')
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null)
  const [showOnlyMyAnnotations, setShowOnlyMyAnnotations] = useState(false)
  const [newAnnotationPos, setNewAnnotationPos] = useState<{ lat: number; lng: number } | null>(null)
  const [annotationTitle, setAnnotationTitle] = useState('')
  const [annotationDetails, setAnnotationDetails] = useState('')
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboardData, setLeaderboardData] = useState<Array<{ author: string; count: number }>>([])
  const [stats, setStats] = useState({ totalDiscoveries: 0, totalExplorers: 0, yourRank: 0 })
  
  const mapContainerRef = useRef<HTMLDivElement | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 3000)
  }, [])

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser)
    return unsubscribe
  }, [])

  // Load initial stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'annotations'))
        const counts: Record<string, number> = {}
        
        snapshot.forEach((doc) => {
          const author = doc.data().author ?? 'Anonymous'
          counts[author] = (counts[author] || 0) + 1
        })

        const totalDiscoveries = snapshot.size
        const totalExplorers = Object.keys(counts).length
        const currentUserName = user?.displayName ?? user?.email ?? 'Unknown'
        const yourRank = user ? Object.entries(counts)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .findIndex(([author]) => author === currentUserName) + 1 : 0
        
        setStats({ totalDiscoveries, totalExplorers, yourRank })
      } catch (error) {
        console.error('Failed to load stats', error)
      }
    }
    
    loadStats()
    const interval = setInterval(loadStats, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [user])

  // Map initialization
  useEffect(() => {
    const L = (window as any).L as LeafletModule | undefined
    const container = mapContainerRef.current

    if (!L || !container) return

    container.replaceChildren()

    // Configure marker icons
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    // Create map
    const map = L.map(container, {
      center: [0, 0],
      zoom: 2,
      minZoom: 1,
      maxZoom: activeBody.maxZoom,
      zoomControl: true,
      crs: L.CRS.EPSG4326,
      worldCopyJump: false,
      maxBoundsViscosity: 1,
    })

    // Set bounds to prevent wrapping
    map.setMaxBounds([[-90, -180], [90, 180]])

    // Add tile layer
    L.tileLayer(activeBody.baseUrl, {
      attribution: activeBody.attribution,
      maxZoom: activeBody.maxZoom,
      noWrap: true,
      bounds: [[-90, -180], [90, 180]],
    }).addTo(map)

    // Add scale
    L.control.scale({ position: 'bottomleft' }).addTo(map)

    const markers: L.Marker[] = []

    // Load annotations
    const annotationsQuery = showOnlyMyAnnotations && user
      ? query(
          collection(db, 'annotations'),
          where('celestialBody', '==', activeBody.name),
          where('author', '==', user.displayName ?? user.email ?? 'Unknown')
        )
      : query(
          collection(db, 'annotations'),
          where('celestialBody', '==', activeBody.name)
        )

    const unsubscribeAnnotations = onSnapshot(annotationsQuery, (snapshot) => {
      markers.forEach((marker) => marker.remove())
      markers.length = 0

      snapshot.forEach((doc) => {
        const data = doc.data()
        if (!data) return

        const annotation: Annotation = {
          id: doc.id,
          lat: data.lat,
          lng: data.lng,
          text: data.text ?? 'Unnamed discovery',
          author: data.author ?? 'Explorer',
          celestialBody: data.celestialBody ?? activeBody.name,
        }

        // Determine if this annotation belongs to the current user
        const isMyAnnotation = user && annotation.author === (user.displayName ?? user.email ?? 'Unknown')
        
        // Create marker with different color for user's own annotations
        const markerIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            width: 24px;
            height: 24px;
            background: ${isMyAnnotation ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : 'linear-gradient(135deg, #3b82f6, #2563eb)'};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 0 0 ${isMyAnnotation ? 'rgba(251, 191, 36, 0.6)' : 'rgba(59, 130, 246, 0.6)'};
            cursor: pointer;
            animation: marker-pulse 2s infinite ease-in-out;
            transition: all 0.3s ease;
          " onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })

        const marker = L.marker([annotation.lat, annotation.lng], { icon: markerIcon })
          .addTo(map)

        // Click handler to show annotation details
        marker.on('click', () => {
          setSelectedAnnotation(annotation)
        })

        markers.push(marker)
      })
    })

    // Click handler for adding annotations
    map.on('click', async (event: L.LeafletMouseEvent) => {
      if (!auth.currentUser) {
        showToast('Please sign in to add markers')
        return
      }

      // Open the annotation creation modal
      setNewAnnotationPos({ lat: event.latlng.lat, lng: event.latlng.lng })
    })

    // Fit to bounds and invalidate size
    map.fitBounds([[-90, -180], [90, 180]])
    setTimeout(() => map.invalidateSize(), 100)

    return () => {
      unsubscribeAnnotations()
      markers.forEach((marker) => marker.remove())
      map.off()
      map.remove()
    }
  }, [activeBody, showToast, showOnlyMyAnnotations, user])

  const handleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      showToast(`Welcome, ${result.user.displayName}!`)
    } catch (error) {
      console.error('Sign in failed', error)
      showToast('Sign in failed')
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      showToast('Signed out')
    } catch (error) {
      console.error('Sign out failed', error)
      showToast('Sign out failed')
    }
  }

  const handleSubmitAnnotation = async () => {
    if (!newAnnotationPos || !annotationTitle.trim()) return

    try {
      await addDoc(collection(db, 'annotations'), {
        lat: newAnnotationPos.lat,
        lng: newAnnotationPos.lng,
        text: annotationTitle.trim(),
        details: annotationDetails.trim() || undefined,
        author: auth.currentUser?.displayName ?? 'Anonymous',
        celestialBody: activeBody.name,
        userId: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
      })
      showToast('🎉 Discovery added! +1 to your count!')
      
      // Trigger confetti effect
      createConfetti()
      
      setNewAnnotationPos(null)
      setAnnotationTitle('')
      setAnnotationDetails('')
    } catch (error) {
      console.error('Failed to save annotation', error)
      showToast('Failed to save discovery')
    }
  }

  const createConfetti = () => {
    const colors = ['#fbbf24', '#3b82f6', '#a855f7', '#ec4899', '#10b981']
    const confettiCount = 50
    
    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div')
      confetti.style.cssText = `
        position: fixed;
        width: ${Math.random() * 10 + 5}px;
        height: ${Math.random() * 10 + 5}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        top: 50%;
        left: 50%;
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        pointer-events: none;
        z-index: 9999;
        animation: confetti-fall ${Math.random() * 3 + 2}s ease-out forwards;
        transform: translate(-50%, -50%) rotate(${Math.random() * 360}deg);
        opacity: 1;
      `
      document.body.appendChild(confetti)
      
      setTimeout(() => confetti.remove(), 5000)
    }
  }

  const loadLeaderboard = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'annotations'))
      const counts: Record<string, number> = {}
      
      snapshot.forEach((doc) => {
        const author = doc.data().author ?? 'Anonymous'
        counts[author] = (counts[author] || 0) + 1
      })

      const sorted = Object.entries(counts)
        .map(([author, count]) => ({ author, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      setLeaderboardData(sorted)
      
      // Calculate stats
      const totalDiscoveries = snapshot.size
      const totalExplorers = Object.keys(counts).length
      const currentUserName = user?.displayName ?? user?.email ?? 'Unknown'
      const yourRank = Object.entries(counts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .findIndex(([author]) => author === currentUserName) + 1
      
      setStats({ totalDiscoveries, totalExplorers, yourRank })
      setShowLeaderboard(true)
    } catch (error) {
      console.error('Failed to load leaderboard', error)
      showToast('Failed to load leaderboard')
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'linear-gradient(to bottom right, #0f172a, #581c87, #0f172a)', position: 'relative', overflow: 'hidden' }}>
      {/* Animated Starfield Background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0
      }}>
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: Math.random() * 3 + 'px',
              height: Math.random() * 3 + 'px',
              background: 'white',
              borderRadius: '50%',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              animation: `twinkle ${Math.random() * 3 + 2}s infinite ease-in-out`,
              opacity: Math.random() * 0.7 + 0.3,
              boxShadow: '0 0 ' + (Math.random() * 4 + 2) + 'px rgba(255, 255, 255, 0.8)'
            }}
          />
        ))}
        {[...Array(5)].map((_, i) => (
          <div
            key={`shooting-${i}`}
            style={{
              position: 'absolute',
              width: '2px',
              height: '2px',
              background: 'white',
              borderRadius: '50%',
              top: Math.random() * 50 + '%',
              left: '-5%',
              animation: `shooting-star ${Math.random() * 3 + 4}s infinite linear`,
              animationDelay: `${Math.random() * 5}s`,
              boxShadow: '0 0 10px 2px rgba(255, 255, 255, 0.8)',
              opacity: 0
            }}
          />
        ))}
      </div>

      {/* Sidebar */}
      <aside style={{ 
        width: '384px', 
        backgroundColor: 'rgba(30, 41, 59, 0.95)', 
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(168, 85, 247, 0.3)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        color: 'white',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Header */}
        <div style={{ 
          padding: '24px', 
          borderBottom: '1px solid rgba(168, 85, 247, 0.3)',
          background: 'linear-gradient(to bottom right, rgba(147, 51, 234, 0.2), rgba(219, 39, 119, 0.2))'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              background: 'linear-gradient(to bottom right, #a855f7, #ec4899, #9333ea)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              boxShadow: '0 10px 40px rgba(168, 85, 247, 0.5)'
            }}>
              🌌
            </div>
            <div>
              <h1 style={{ 
                fontSize: '28px', 
                fontWeight: 'bold',
                background: 'linear-gradient(to right, #e9d5ff, #fbcfe8, #e9d5ff)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                margin: 0
              }}>
                UniExplorer
              </h1>
              <p style={{ fontSize: '14px', color: '#e9d5ff', margin: 0 }}>Planetary Explorer</p>
            </div>
          </div>

          {/* Quick Stats */}
          {stats.totalDiscoveries > 0 && (
            <div style={{ 
              marginTop: '16px',
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              <div style={{ 
                flex: 1,
                minWidth: '80px',
                padding: '8px 12px',
                background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.3), rgba(219, 39, 119, 0.3))',
                borderRadius: '8px',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#e9d5ff' }}>
                  {stats.totalDiscoveries}
                </div>
                <div style={{ fontSize: '10px', color: '#c084fc', textTransform: 'uppercase' }}>
                  Discoveries
                </div>
              </div>
              <div style={{ 
                flex: 1,
                minWidth: '80px',
                padding: '8px 12px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(251, 191, 36, 0.3))',
                borderRadius: '8px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fef3c7' }}>
                  {stats.totalExplorers}
                </div>
                <div style={{ fontSize: '10px', color: '#fbbf24', textTransform: 'uppercase' }}>
                  Explorers
                </div>
              </div>
              {user && stats.yourRank > 0 && (
                <div style={{ 
                  flex: 1,
                  minWidth: '80px',
                  padding: '8px 12px',
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(22, 163, 74, 0.3))',
                  borderRadius: '8px',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#d1fae5' }}>
                    #{stats.yourRank}
                  </div>
                  <div style={{ fontSize: '10px', color: '#4ade80', textTransform: 'uppercase' }}>
                    Your Rank
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Auth */}
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '16px',
                backgroundColor: 'rgba(51, 65, 85, 0.8)',
                borderRadius: '12px',
                border: '1px solid rgba(168, 85, 247, 0.2)'
              }}>
                {user.photoURL && (
                  <img 
                    src={user.photoURL} 
                    alt="Profile" 
                    style={{ 
                      width: '48px', 
                      height: '48px', 
                      borderRadius: '50%',
                      border: '2px solid #c084fc'
                    }} 
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: 'white',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    margin: 0
                  }}>
                    {user.displayName}
                  </p>
                  <p style={{ fontSize: '12px', color: '#d8b4fe', margin: 0 }}>Authenticated Explorer</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.5)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              style={{
                width: '100%',
                padding: '16px 24px',
                background: 'linear-gradient(to right, #9333ea, #db2777)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(147, 51, 234, 0.5)',
                transition: 'all 0.2s'
              }}
            >
              🚀 Sign In with Google
            </button>
          )}
        </div>

        {/* Annotation Filter Toggle */}
        {user && (
          <div style={{ padding: '0 24px 16px 24px' }}>
            <label style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              backgroundColor: 'rgba(51, 65, 85, 0.5)',
              borderRadius: '8px',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}>
              <input
                type="checkbox"
                checked={showOnlyMyAnnotations}
                onChange={(e) => setShowOnlyMyAnnotations(e.target.checked)}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer',
                  accentColor: '#9333ea'
                }}
              />
              <span style={{ 
                fontSize: '14px',
                color: '#e9d5ff',
                fontWeight: '500',
                userSelect: 'none'
              }}>
                Show only my annotations
              </span>
            </label>
          </div>
        )}

        {/* Destinations */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          <h2 style={{ 
            fontSize: '12px', 
            fontWeight: 'bold',
            color: '#d8b4fe',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '16px'
          }}>
            Select Destination
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.values(celestialBodies).map((body) => (
              <button
                key={body.name}
                onClick={() => setActiveBody(body)}
                style={{
                  width: '100%',
                  padding: '20px',
                  borderRadius: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: activeBody.name === body.name 
                    ? 'linear-gradient(to right, #9333ea, #db2777)'
                    : 'rgba(51, 65, 85, 0.8)',
                  border: activeBody.name === body.name 
                    ? '2px solid #c084fc'
                    : '2px solid transparent',
                  boxShadow: activeBody.name === body.name 
                    ? '0 10px 40px rgba(147, 51, 234, 0.5)'
                    : 'none'
                }}
                onMouseOver={(e) => {
                  if (activeBody.name !== body.name) {
                    e.currentTarget.style.backgroundColor = 'rgba(71, 85, 105, 0.8)'
                  }
                }}
                onMouseOut={(e) => {
                  if (activeBody.name !== body.name) {
                    e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.8)'
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '40px' }}>{body.emoji}</span>
                  <div>
                    <h3 style={{ 
                      fontWeight: 'bold', 
                      fontSize: '18px', 
                      color: 'white',
                      margin: 0,
                      marginBottom: '4px'
                    }}>
                      {body.name}
                    </h3>
                    <p style={{ 
                      fontSize: '14px', 
                      color: '#e9d5ff',
                      margin: 0
                    }}>
                      Max Zoom: Level {body.maxZoom}
                    </p>
                  </div>
                  {activeBody.name === body.name && (
                    <span style={{ marginLeft: 'auto', fontSize: '24px' }}>✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Info */}
          <div style={{ 
            marginTop: '24px',
            padding: '20px',
            background: 'linear-gradient(to bottom right, rgba(147, 51, 234, 0.3), rgba(219, 39, 119, 0.3))',
            borderRadius: '12px',
            border: '1px solid rgba(168, 85, 247, 0.3)'
          }}>
            <h3 style={{ 
              fontSize: '14px',
              fontWeight: 'bold',
              color: 'white',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {user ? (
                <>
                  <span style={{ color: '#4ade80' }}>✓</span>
                  Interactive Mode Active
                </>
              ) : (
                <>
                  <span style={{ color: '#facc15' }}>○</span>
                  View Only Mode
                </>
              )}
            </h3>
            <p style={{ 
              fontSize: '14px',
              color: '#f3e8ff',
              lineHeight: '1.6',
              margin: 0
            }}>
              {user 
                ? 'Click anywhere on the map to add discovery markers and document your findings!'
                : 'Sign in with Google to add markers and collaborate with other explorers.'
              }
            </p>
          </div>

          {/* Features */}
          <div style={{ 
            marginTop: '24px',
            padding: '20px',
            backgroundColor: 'rgba(51, 65, 85, 0.5)',
            borderRadius: '12px',
            border: '1px solid rgba(168, 85, 247, 0.2)'
          }}>
            <h3 style={{ 
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#d8b4fe',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px'
            }}>
              Features
            </h3>
            <ul style={{ 
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#f3e8ff' }}>
                <span style={{ color: '#c084fc' }}>•</span>
                Real-time planetary imagery
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#f3e8ff' }}>
                <span style={{ color: '#c084fc' }}>•</span>
                Collaborative annotations
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#f3e8ff' }}>
                <span style={{ color: '#c084fc' }}>•</span>
                Multi-planet exploration
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#f3e8ff' }}>
                <span style={{ color: '#c084fc' }}>•</span>
                Cloud-synced discoveries
              </li>
            </ul>
          </div>

          {/* Leaderboard Button */}
          <button
            onClick={loadLeaderboard}
            style={{
              width: '100%',
              marginTop: '16px',
              padding: '16px 20px',
              background: 'linear-gradient(to right, #f59e0b, #d97706)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            🏆 View Leaderboard
          </button>
        </div>

        {/* Footer */}
        <div style={{ 
          padding: '16px',
          borderTop: '1px solid rgba(168, 85, 247, 0.3)',
          backgroundColor: 'rgba(30, 41, 59, 0.8)'
        }}>
          <p style={{ 
            fontSize: '12px',
            color: '#d8b4fe',
            textAlign: 'center',
            fontWeight: '500',
            margin: 0
          }}>
            🛰️ Data: USGS Astrogeology • CartoCDN
          </p>
        </div>
      </aside>

      {/* Map Container */}
      <main style={{ flex: 1, position: 'relative', backgroundColor: '#000000' }}>
        <div
          ref={mapContainerRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        
        {/* Login Banner (shown when not authenticated) */}
        {!user && (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            padding: '16px 32px',
            background: 'linear-gradient(to right, rgba(147, 51, 234, 0.95), rgba(219, 39, 119, 0.95))',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            animation: 'bounce-in 0.5s ease-out'
          }}>
            <span style={{ fontSize: '24px' }}>🔒</span>
            <span style={{
              fontSize: '16px',
              fontWeight: '600',
              color: 'white'
            }}>
              Sign in to add annotations and explore collaboratively!
            </span>
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          padding: '16px 24px',
          background: 'linear-gradient(to right, #9333ea, #db2777)',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(147, 51, 234, 0.5)',
          color: 'white',
          fontWeight: '600',
          animation: 'slide-in 0.3s ease-out'
        }}>
          ✨ {toast}
        </div>
      )}

      {/* New Annotation Creation Modal */}
      {newAnnotationPos && (
        <>
          {/* Backdrop */}
          <div 
            onClick={() => {
              setNewAnnotationPos(null)
              setAnnotationTitle('')
              setAnnotationDetails('')
            }}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(4px)',
              zIndex: 1000,
              animation: 'fade-in 0.2s ease-out'
            }}
          />
          
          {/* Modal */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: '500px',
            backgroundColor: 'rgba(30, 41, 59, 0.98)',
            borderRadius: '16px',
            border: '2px solid rgba(168, 85, 247, 0.5)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            zIndex: 1001,
            animation: 'scale-in 0.2s ease-out',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '24px',
              background: 'linear-gradient(to right, #9333ea, #db2777)',
              borderBottom: '1px solid rgba(168, 85, 247, 0.3)'
            }}>
              <h3 style={{ 
                fontSize: '20px',
                fontWeight: 'bold',
                color: 'white',
                margin: 0
              }}>
                🚀 Add New Discovery
              </h3>
            </div>

            {/* Form */}
            <div style={{ padding: '24px' }}>
              {/* Title Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#d8b4fe',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: '8px'
                }}>
                  Title / Description *
                </label>
                <input
                  type="text"
                  value={annotationTitle}
                  onChange={(e) => setAnnotationTitle(e.target.value)}
                  placeholder="e.g., Olympus Mons Base Camp"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(51, 65, 85, 0.8)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: '8px',
                    color: '#f3e8ff',
                    fontSize: '15px',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(168, 85, 247, 0.6)'
                    e.target.style.backgroundColor = 'rgba(51, 65, 85, 1)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(168, 85, 247, 0.3)'
                    e.target.style.backgroundColor = 'rgba(51, 65, 85, 0.8)'
                  }}
                />
              </div>

              {/* Details Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#d8b4fe',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: '8px'
                }}>
                  Additional Details (Optional)
                </label>
                <textarea
                  value={annotationDetails}
                  onChange={(e) => setAnnotationDetails(e.target.value)}
                  placeholder="Add more information about this location..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(51, 65, 85, 0.8)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: '8px',
                    color: '#f3e8ff',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(168, 85, 247, 0.6)'
                    e.target.style.backgroundColor = 'rgba(51, 65, 85, 1)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(168, 85, 247, 0.3)'
                    e.target.style.backgroundColor = 'rgba(51, 65, 85, 0.8)'
                  }}
                />
              </div>

              {/* Location Info */}
              <div style={{ 
                marginBottom: '24px',
                padding: '12px 16px',
                backgroundColor: 'rgba(51, 65, 85, 0.5)',
                borderRadius: '8px',
                border: '1px solid rgba(168, 85, 247, 0.2)'
              }}>
                <div style={{ fontSize: '11px', color: '#c084fc', marginBottom: '6px' }}>
                  Coordinates
                </div>
                <div style={{ fontSize: '13px', color: '#f3e8ff', fontFamily: 'monospace' }}>
                  {newAnnotationPos.lat.toFixed(4)}°, {newAnnotationPos.lng.toFixed(4)}°
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setNewAnnotationPos(null)
                    setAnnotationTitle('')
                    setAnnotationDetails('')
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    backgroundColor: 'rgba(51, 65, 85, 0.8)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: '8px',
                    color: '#e9d5ff',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.8)'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitAnnotation}
                  disabled={!annotationTitle.trim()}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    background: annotationTitle.trim() 
                      ? 'linear-gradient(to right, #9333ea, #db2777)' 
                      : 'rgba(51, 65, 85, 0.5)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: annotationTitle.trim() ? 'pointer' : 'not-allowed',
                    opacity: annotationTitle.trim() ? 1 : 0.5,
                    transition: 'all 0.2s'
                  }}
                >
                  Add Discovery
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <>
          {/* Backdrop */}
          <div 
            onClick={() => setShowLeaderboard(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(4px)',
              zIndex: 1000,
              animation: 'fade-in 0.2s ease-out'
            }}
          />
          
          {/* Modal */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            backgroundColor: 'rgba(30, 41, 59, 0.98)',
            borderRadius: '16px',
            border: '2px solid rgba(245, 158, 11, 0.5)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            zIndex: 1001,
            animation: 'scale-in 0.2s ease-out',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              padding: '24px',
              background: 'linear-gradient(to right, #f59e0b, #d97706)',
              borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ 
                fontSize: '24px',
                fontWeight: 'bold',
                color: 'white',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                🏆 Explorer Leaderboard
              </h3>
              <button
                onClick={() => setShowLeaderboard(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              >
                ✕
              </button>
            </div>

            {/* Leaderboard List */}
            <div style={{ 
              padding: '24px',
              overflowY: 'auto',
              flex: 1
            }}>
              {leaderboardData.length === 0 ? (
                <div style={{ 
                  textAlign: 'center',
                  padding: '40px',
                  color: '#d8b4fe'
                }}>
                  <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🌌</p>
                  <p style={{ fontSize: '16px', margin: 0 }}>No discoveries yet. Be the first!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {leaderboardData.map((entry, index) => {
                    const isCurrentUser = user && entry.author === (user.displayName ?? user.email ?? 'Unknown')
                    const medals = ['🥇', '🥈', '🥉']
                    const medal = index < 3 ? medals[index] : `${index + 1}.`
                    
                    return (
                      <div
                        key={entry.author}
                        style={{
                          padding: '16px 20px',
                          backgroundColor: isCurrentUser 
                            ? 'rgba(251, 191, 36, 0.2)' 
                            : 'rgba(51, 65, 85, 0.5)',
                          border: isCurrentUser 
                            ? '2px solid rgba(251, 191, 36, 0.5)' 
                            : '1px solid rgba(168, 85, 247, 0.2)',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          transition: 'all 0.2s'
                        }}
                      >
                        {/* Rank */}
                        <div style={{
                          fontSize: '24px',
                          fontWeight: 'bold',
                          minWidth: '40px',
                          textAlign: 'center'
                        }}>
                          {medal}
                        </div>

                        {/* Author */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: isCurrentUser ? '#fbbf24' : '#e9d5ff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {entry.author}
                            {isCurrentUser && (
                              <span style={{
                                marginLeft: '8px',
                                fontSize: '12px',
                                color: '#fbbf24',
                                fontWeight: 'bold'
                              }}>
                                (You)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Count */}
                        <div style={{
                          padding: '8px 16px',
                          backgroundColor: 'rgba(147, 51, 234, 0.3)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span style={{ fontSize: '18px' }}>📍</span>
                          <span style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: '#c084fc'
                          }}>
                            {entry.count}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(245, 158, 11, 0.3)',
              backgroundColor: 'rgba(30, 41, 59, 0.8)',
              textAlign: 'center'
            }}>
              <p style={{
                fontSize: '13px',
                color: '#d8b4fe',
                margin: 0
              }}>
                Top {leaderboardData.length} explorers across all celestial bodies
              </p>
            </div>
          </div>
        </>
      )}

      {/* Annotation Details Panel */}
      {selectedAnnotation && (
        <>
          {/* Backdrop */}
          <div 
            onClick={() => setSelectedAnnotation(null)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(4px)',
              zIndex: 1000,
              animation: 'fade-in 0.2s ease-out'
            }}
          />
          
          {/* Panel */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: '500px',
            backgroundColor: 'rgba(30, 41, 59, 0.98)',
            borderRadius: '16px',
            border: '2px solid rgba(168, 85, 247, 0.5)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            zIndex: 1001,
            animation: 'scale-in 0.2s ease-out',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '24px',
              background: 'linear-gradient(to right, #9333ea, #db2777)',
              borderBottom: '1px solid rgba(168, 85, 247, 0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ 
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: 'white',
                    marginBottom: '8px',
                    margin: 0
                  }}>
                    📍 Discovery Details
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedAnnotation(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: 'white',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: '24px' }}>
              {/* Description */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#d8b4fe',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: '8px'
                }}>
                  Description
                </label>
                <p style={{ 
                  fontSize: '16px',
                  color: '#f3e8ff',
                  lineHeight: '1.6',
                  margin: 0,
                  padding: '12px 16px',
                  backgroundColor: 'rgba(51, 65, 85, 0.5)',
                  borderRadius: '8px',
                  border: '1px solid rgba(168, 85, 247, 0.2)'
                }}>
                  {selectedAnnotation.text}
                </p>
              </div>

              {/* Author */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#d8b4fe',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: '8px'
                }}>
                  Discovered By
                </label>
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(51, 65, 85, 0.5)',
                  borderRadius: '8px',
                  border: '1px solid rgba(168, 85, 247, 0.2)'
                }}>
                  <span style={{ 
                    fontSize: '20px'
                  }}>
                    {user && selectedAnnotation.author === (user.displayName ?? user.email ?? 'Unknown') ? '👤' : '👥'}
                  </span>
                  <span style={{ 
                    fontSize: '15px',
                    color: '#e9d5ff',
                    fontWeight: '500'
                  }}>
                    {selectedAnnotation.author}
                    {user && selectedAnnotation.author === (user.displayName ?? user.email ?? 'Unknown') && (
                      <span style={{ 
                        marginLeft: '8px',
                        fontSize: '13px',
                        color: '#fbbf24',
                        fontWeight: 'bold'
                      }}>
                        (You)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Location */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#d8b4fe',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: '8px'
                }}>
                  Coordinates
                </label>
                <div style={{ 
                  display: 'flex',
                  gap: '12px'
                }}>
                  <div style={{ 
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: 'rgba(51, 65, 85, 0.5)',
                    borderRadius: '8px',
                    border: '1px solid rgba(168, 85, 247, 0.2)'
                  }}>
                    <div style={{ fontSize: '11px', color: '#c084fc', marginBottom: '4px' }}>
                      Latitude
                    </div>
                    <div style={{ fontSize: '14px', color: '#f3e8ff', fontWeight: '600' }}>
                      {selectedAnnotation.lat.toFixed(4)}°
                    </div>
                  </div>
                  <div style={{ 
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: 'rgba(51, 65, 85, 0.5)',
                    borderRadius: '8px',
                    border: '1px solid rgba(168, 85, 247, 0.2)'
                  }}>
                    <div style={{ fontSize: '11px', color: '#c084fc', marginBottom: '4px' }}>
                      Longitude
                    </div>
                    <div style={{ fontSize: '14px', color: '#f3e8ff', fontWeight: '600' }}>
                      {selectedAnnotation.lng.toFixed(4)}°
                    </div>
                  </div>
                </div>
              </div>

              {/* Celestial Body */}
              <div>
                <label style={{ 
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#d8b4fe',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: '8px'
                }}>
                  Location
                </label>
                <div style={{ 
                  padding: '12px 16px',
                  backgroundColor: 'rgba(51, 65, 85, 0.5)',
                  borderRadius: '8px',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>
                    {celestialBodies[selectedAnnotation.celestialBody.toLowerCase()]?.emoji ?? '🌍'}
                  </span>
                  <span style={{ fontSize: '15px', color: '#e9d5ff', fontWeight: '500' }}>
                    {selectedAnnotation.celestialBody}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes bounce-in {
          0% {
            transform: translateX(-50%) translateY(-100px);
            opacity: 0;
          }
          60% {
            transform: translateX(-50%) translateY(10px);
            opacity: 1;
          }
          80% {
            transform: translateX(-50%) translateY(-5px);
          }
          100% {
            transform: translateX(-50%) translateY(0);
          }
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scale-in {
          from {
            transform: translate(-50%, -50%) scale(0.9);
            opacity: 0;
          }
          to {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }

        @keyframes slide-in {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        @keyframes shooting-star {
          0% {
            transform: translateX(0) translateY(0);
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: translateX(300px) translateY(300px);
            opacity: 0;
          }
        }

        @keyframes marker-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          }
          50% {
            transform: scale(1.15);
            box-shadow: 0 4px 16px rgba(168, 85, 247, 0.6);
          }
        }

        @keyframes confetti-fall {
          0% {
            transform: translate(-50%, -50%) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate(${Math.random() * 400 - 200}px, ${Math.random() * 600 + 300}px) rotate(${Math.random() * 720}deg);
            opacity: 0;
          }
        }

        /* Leaflet controls */
        .leaflet-control-zoom {
          border: none !important;
          background: rgba(31, 41, 55, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          border-radius: 0.5rem !important;
          overflow: hidden !important;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
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
          background: rgba(31, 41, 55, 0.95) !important;
          backdrop-filter: blur(10px) !important;
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
          background: rgba(31, 41, 55, 0.98) !important;
          backdrop-filter: blur(10px) !important;
          border: 1px solid rgba(147, 51, 234, 0.5) !important;
          border-radius: 0.75rem !important;
          color: white !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8) !important;
        }

        .leaflet-popup-tip {
          background: rgba(31, 41, 55, 0.98) !important;
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
