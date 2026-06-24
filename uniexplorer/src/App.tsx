import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from './firebaseConfig';
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { useAuth } from './hooks/useAuth';
import { celestialBodies } from './constants';
import type { Annotation, CelestialBody, LeaderboardItem } from './types';

// UI components
import { Toast } from './components/ui';

// Feature components
import { TopoBg } from './components/TopoBg';
import { CommandBar } from './components/CommandBar';
import { PlanetSelector } from './components/PlanetSelector';
import { FilterPanel } from './components/FilterPanel';
import { FeatureShowcase } from './components/FeatureShowcase';
import { SignInBanner } from './components/SignInBanner';
import { MapContainer } from './components/MapContainer';
import { MapOverlay } from './components/MapOverlay';
import { StatsBar } from './components/StatsBar';
import { AnnotationForm } from './components/AnnotationForm';
import { AnnotationDetail } from './components/AnnotationDetail';
import { LeaderboardModal } from './components/LeaderboardModal';

type LeafletModule = typeof import('leaflet');

function App() {
  const [activeBody, setActiveBody] = useState<CelestialBody>(celestialBodies.mars);
  const [toast, setToast] = useState<string>('');
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [showOnlyMyAnnotations, setShowOnlyMyAnnotations] = useState(false);
  const [newAnnotationPos, setNewAnnotationPos] = useState<{ lat: number; lng: number } | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardItem[]>([]);
  const [stats, setStats] = useState({ totalDiscoveries: 0, totalExplorers: 0, yourRank: 0 });
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  const handleCloseToast = useCallback(() => {
    setToast('');
  }, []);

  const { user, signIn, signOut } = useAuth(showToast);

  // Load leaderboard & stats
  useEffect(() => {
    const loadStatsAndLeaderboard = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'annotations'));
        const counts: Record<string, number> = {};
        
        snapshot.forEach((doc) => {
          const author = doc.data().author ?? 'Anonymous';
          counts[author] = (counts[author] || 0) + 1;
        });

        const sortedLeaderboard = Object.entries(counts)
          .map(([author, count]) => ({ author, count }))
          .sort((a, b) => b.count - a.count);
        
        setLeaderboardData(sortedLeaderboard);

        const totalDiscoveries = snapshot.size;
        const totalExplorers = Object.keys(counts).length;
        const currentUserName = user?.displayName ?? user?.email ?? 'Unknown';
        const yourRank = user ? sortedLeaderboard.findIndex((item) => item.author === currentUserName) + 1 : 0;
        
        setStats({ totalDiscoveries, totalExplorers, yourRank });
      } catch (error) {
        console.error('Failed to load stats/leaderboard', error);
      }
    };
    
    loadStatsAndLeaderboard();
    const interval = setInterval(loadStatsAndLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Map initialization
  useEffect(() => {
    const L = (window as any).L as LeafletModule | undefined;
    const container = mapContainerRef.current;

    if (!L || !container) return;

    container.replaceChildren();

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(container, {
      center: [0, 0],
      zoom: 2,
      minZoom: 1,
      maxZoom: activeBody.maxZoom,
      zoomControl: true,
      crs: L.CRS.EPSG4326,
      worldCopyJump: false,
      maxBoundsViscosity: 1,
    });

    map.setMaxBounds([[-90, -180], [90, 180]]);

    L.tileLayer(activeBody.baseUrl, {
      attribution: activeBody.attribution,
      maxZoom: activeBody.maxZoom,
      noWrap: true,
      bounds: [[-90, -180], [90, 180]],
    }).addTo(map);

    L.control.scale({ position: 'bottomleft' }).addTo(map);

    const markers: L.Marker[] = [];
    const currentUserName = user?.displayName ?? user?.email ?? 'Unknown';
    const annotationsQuery = showOnlyMyAnnotations && user
      ? query(
          collection(db, 'annotations'),
          where('celestialBody', '==', activeBody.name),
          where('author', '==', currentUserName)
        )
      : query(
          collection(db, 'annotations'),
          where('celestialBody', '==', activeBody.name)
        );

    const unsubscribeAnnotations = onSnapshot(annotationsQuery, (snapshot) => {
      markers.forEach((marker) => marker.remove());
      markers.length = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data) return;

        const annotation: Annotation = {
          id: doc.id,
          lat: data.lat,
          lng: data.lng,
          text: data.text ?? 'Unnamed discovery',
          details: data.details,
          author: data.author ?? 'Explorer',
          celestialBody: data.celestialBody ?? activeBody.name,
        };

        const isMyAnnotation = user && annotation.author === currentUserName;
        
        const markerIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            width: 20px;
            height: 20px;
            background: ${isMyAnnotation ? 'linear-gradient(135deg, #15803D, #059669)' : 'linear-gradient(135deg, #C2410C, #D97706)'};
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            transition: all 0.2s ease;
          " onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker([annotation.lat, annotation.lng], { icon: markerIcon })
          .addTo(map);

        marker.on('click', () => {
          setSelectedAnnotation(annotation);
        });

        markers.push(marker);
      });
    });

    map.on('click', (event: L.LeafletMouseEvent) => {
      if (!user) {
        showToast('Please sign in to add markers');
        return;
      }
      setNewAnnotationPos({ lat: event.latlng.lat, lng: event.latlng.lng });
    });

    map.on('mousemove', (event: L.LeafletMouseEvent) => {
      setCursorCoords({ lat: event.latlng.lat, lng: event.latlng.lng });
    });

    map.on('mouseout', () => {
      setCursorCoords(null);
    });

    map.fitBounds([[-90, -180], [90, 180]]);
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      unsubscribeAnnotations();
      map.remove();
    };
  }, [activeBody, showOnlyMyAnnotations, user, showToast]);

  const handleSubmitAnnotation = async (title: string, details: string) => {
    if (!newAnnotationPos) return;

    try {
      await addDoc(collection(db, 'annotations'), {
        lat: newAnnotationPos.lat,
        lng: newAnnotationPos.lng,
        text: title,
        details: details || undefined,
        author: user?.displayName ?? 'Anonymous',
        celestialBody: activeBody.name,
        userId: user?.uid,
        createdAt: serverTimestamp(),
      });
      showToast('🎉 Discovery added! +1 to your count!');
    } catch (error) {
      console.error('Failed to save annotation', error);
      showToast('Failed to save discovery');
      throw error;
    }
  };

  const currentUserName = user?.displayName ?? user?.email ?? null;

  return (
    <div className="app-container" style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <TopoBg />

      <MapContainer mapRef={mapContainerRef} />

      <CommandBar
        user={user}
        onSignIn={signIn}
        onSignOut={signOut}
        onShowLeaderboard={() => setShowLeaderboard(true)}
        userRank={stats.yourRank}
      />

      <PlanetSelector
        celestialBodies={celestialBodies}
        activeBody={activeBody}
        onSelect={setActiveBody}
      />

      <FeatureShowcase />

      <FilterPanel
        showOnlyMyAnnotations={showOnlyMyAnnotations}
        onChangeShowOnlyMyAnnotations={setShowOnlyMyAnnotations}
        isAuthenticated={!!user}
      />

      <MapOverlay
        cursorCoords={cursorCoords}
        activeBodyName={activeBody.name}
      />

      <StatsBar
        totalDiscoveries={stats.totalDiscoveries}
        totalExplorers={stats.totalExplorers}
        yourRank={stats.yourRank}
        activeBodyName={activeBody.name}
      />

      {!user && <SignInBanner onSignIn={signIn} />}

      {newAnnotationPos && (
        <AnnotationForm
          isOpen={!!newAnnotationPos}
          onClose={() => setNewAnnotationPos(null)}
          onSubmit={handleSubmitAnnotation}
          lat={newAnnotationPos.lat}
          lng={newAnnotationPos.lng}
        />
      )}

      {selectedAnnotation && (
        <AnnotationDetail
          isOpen={!!selectedAnnotation}
          onClose={() => setSelectedAnnotation(null)}
          annotation={selectedAnnotation}
          currentUser={user}
        />
      )}

      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        data={leaderboardData}
        currentUserName={currentUserName}
      />

      {toast && (
        <Toast
          message={toast}
          onClose={handleCloseToast}
        />
      )}
    </div>
  );
}

export default App;
