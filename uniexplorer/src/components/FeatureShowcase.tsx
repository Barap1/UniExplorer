import { useState } from 'react';
import { Card } from './ui';
import { Compass, Trophy, Pin, X } from './Icons';
import './FeatureShowcase.css';

export const FeatureShowcase = () => {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) return null;

  return (
    <div className="showcase-container animate-fade-in">
      <Card variant="default" className="showcase-card">
        <button className="showcase-close" onClick={() => setIsOpen(false)} aria-label="Close welcome panel">
          <X size={14} />
        </button>
        <h3 className="showcase-title">Planetary Expedition</h3>
        <p className="showcase-subtitle">
          Welcome to UniExplorer, a biophilic terrain interface. Scan and label celestial coordinates:
        </p>

        <div className="showcase-items">
          <div className="showcase-item">
            <Compass size={14} className="showcase-item-icon" />
            <div className="showcase-item-text">
              <h4>Real-Time Scans</h4>
              <p>Explore Mars, Moon, and Mercury basemaps.</p>
            </div>
          </div>
          <div className="showcase-item">
            <Pin size={14} className="showcase-item-icon" />
            <div className="showcase-item-text">
              <h4>Surface Logging</h4>
              <p>Click on the terrain to log geologic observations.</p>
            </div>
          </div>
          <div className="showcase-item">
            <Trophy size={14} className="showcase-item-icon" />
            <div className="showcase-item-text">
              <h4>Explorer Rankings</h4>
              <p>Join the leaderboards and claim discoveries.</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
