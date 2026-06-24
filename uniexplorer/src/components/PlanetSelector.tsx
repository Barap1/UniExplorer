import React from 'react';
import { Planet } from './Icons';
import './PlanetSelector.css';

export interface CelestialBody {
  name: string;
  baseUrl: string;
  attribution: string;
  maxZoom: number;
  emoji: string;
}

export interface PlanetSelectorProps {
  celestialBodies: Record<string, CelestialBody>;
  activeBody: CelestialBody;
  onSelect: (body: CelestialBody) => void;
}

export const PlanetSelector = ({
  celestialBodies,
  activeBody,
  onSelect,
}: PlanetSelectorProps) => {
  const getPlanetColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'mars':
        return 'var(--color-accent)';
      case 'moon':
        return 'var(--color-accent-warm)';
      case 'mercury':
        return 'var(--color-muted-fg)';
      default:
        return 'var(--color-primary)';
    }
  };

  return (
    <div className="planet-selector-container animate-fade-in">
      <div className="planet-selector-pills">
        {Object.values(celestialBodies).map((body) => {
          const isActive = body.name === activeBody.name;
          const planetColor = getPlanetColor(body.name);

          return (
            <button
              key={body.name}
              className={`planet-pill ${isActive ? 'planet-pill-active' : ''}`}
              onClick={() => onSelect(body)}
            >
              <Planet 
                size={16} 
                className="planet-icon" 
                style={{ 
                  stroke: isActive ? 'var(--color-primary)' : planetColor, 
                  fill: isActive ? 'rgba(21, 128, 61, 0.08)' : 'none' 
                }}
              />
              <span className="planet-name">{body.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
