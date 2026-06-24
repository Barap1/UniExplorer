import React from 'react';
import { Leaf, Trophy } from './Icons';
import { Button, Avatar } from './ui';
import type { User } from 'firebase/auth';
import './CommandBar.css';

export interface CommandBarProps {
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onShowLeaderboard: () => void;
  userRank: number;
}

export const CommandBar = ({
  user,
  onSignIn,
  onSignOut,
  onShowLeaderboard,
  userRank,
}: CommandBarProps) => {
  return (
    <header className="command-bar animate-fade-in">
      <div className="command-logo-section">
        <div className="command-logo-badge">
          <Leaf size={18} className="command-logo-icon" />
        </div>
        <h1 className="command-title">UniExplorer</h1>
      </div>

      <div className="command-actions-section">
        <Button variant="ghost" size="sm" onClick={onShowLeaderboard} className="leaderboard-btn">
          <Trophy size={16} className="trophy-icon" />
          <span>Leaderboard</span>
          {userRank > 0 && <span className="rank-badge">#{userRank}</span>}
        </Button>

        {user ? (
          <div className="user-menu-trigger">
            <Avatar src={user.photoURL} name={user.displayName} size="sm" />
            <span className="user-name-display">{user.displayName || 'Explorer'}</span>
            <Button variant="outline" size="sm" onClick={onSignOut} className="sign-out-btn">
              Sign Out
            </Button>
          </div>
        ) : (
          <Button variant="accent" size="sm" onClick={onSignIn}>
            Sign In with Google
          </Button>
        )}
      </div>
    </header>
  );
};
