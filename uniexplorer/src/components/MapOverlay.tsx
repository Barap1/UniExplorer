import './MapOverlay.css';

export interface MapOverlayProps {
  cursorCoords: { lat: number; lng: number } | null;
  activeBodyName: string;
}

export const MapOverlay = ({ cursorCoords, activeBodyName }: MapOverlayProps) => {
  return (
    <div className="map-overlay-container pointer-events-none">
      {cursorCoords && (
        <div className="coords-panel pointer-events-auto animate-fade-in">
          <div className="coords-label">{activeBodyName} SCANNER</div>
          <div className="coords-values">
            <span className="coords-value">LAT: {cursorCoords.lat.toFixed(4)}°</span>
            <span className="coords-divider">|</span>
            <span className="coords-value">LNG: {cursorCoords.lng.toFixed(4)}°</span>
          </div>
        </div>
      )}
    </div>
  );
};
