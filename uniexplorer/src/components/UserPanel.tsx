import React, { useState, useRef, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { Button, Avatar, Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui';
import { User as UserIcon } from './Icons';
import './UserPanel.css';

export interface UserPanelProps {
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  userRank: number;
  discoveryCount: number;
}

export const UserPanel = ({
  user,
  onSignIn,
  onSignOut,
  userRank,
  discoveryCount,
}: UserPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <Button variant="accent" size="sm" onClick={onSignIn} className="user-signin-btn">
        <UserIcon size={14} />
        <span>Sign In</span>
      </Button>
    );
  }

  return (
    <div className="user-panel-wrapper" ref={containerRef}>
      <button 
        type="button" 
        className="user-panel-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle user panel"
      >
        <Avatar src={user.photoURL} name={user.displayName} size="sm" />
      </button>

      {isOpen && (
        <div className="user-panel-dropdown animate-fade-in">
          <Card variant="default" className="user-panel-card">
            <CardHeader className="user-panel-header">
              <Avatar src={user.photoURL} name={user.displayName} size="md" />
              <div className="user-profile-info">
                <CardTitle className="user-profile-name">{user.displayName || 'Explorer'}</CardTitle>
                <span className="user-profile-email">{user.email}</span>
              </div>
            </CardHeader>
            <CardContent className="user-panel-content">
              <div className="user-stat-grid">
                <div className="user-stat-box">
                  <span className="user-stat-num">{discoveryCount}</span>
                  <span className="user-stat-lbl">Discoveries</span>
                </div>
                <div className="user-stat-box">
                  <span className="user-stat-num">{userRank > 0 ? `#${userRank}` : 'N/A'}</span>
                  <span className="user-stat-lbl">Rank</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="user-panel-footer">
              <Button variant="outline" size="sm" onClick={() => { onSignOut(); setIsOpen(false); }} className="w-full">
                Sign Out
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};
