import React from 'react';
import './MapContainer.css';

export interface MapContainerProps {
  mapRef: React.RefObject<HTMLDivElement | null>;
}

export const MapContainer = ({ mapRef }: MapContainerProps) => {
  return (
    <div className="map-fullbleed-container animate-fade-in">
      <div ref={mapRef} className="map-element" />
    </div>
  );
};
