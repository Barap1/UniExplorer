import React from 'react';
import { Modal, Badge } from './ui';
import { Trophy } from './Icons';
import './LeaderboardModal.css';

export interface LeaderboardItem {
  author: string;
  count: number;
}

export interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: LeaderboardItem[];
  currentUserName?: string | null;
}

export const LeaderboardModal = ({
  isOpen,
  onClose,
  data,
  currentUserName,
}: LeaderboardModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Discovery Leaderboard">
      <div className="leaderboard-container">
        <p className="leaderboard-subtitle">
          Leading planetary explorers ranked by verified surface discoveries.
        </p>

        <div className="leaderboard-list">
          {data.length === 0 ? (
            <div className="leaderboard-empty">No discoveries logged yet.</div>
          ) : (
            data.map((item, index) => {
              const rank = index + 1;
              const isCurrentUser = currentUserName && item.author === currentUserName;
              const isTop3 = rank <= 3;
              
              const getMedalClass = (r: number) => {
                if (r === 1) return 'gold-medal';
                if (r === 2) return 'silver-medal';
                if (r === 3) return 'bronze-medal';
                return '';
              };

              return (
                <div 
                  key={item.author} 
                  className={`leaderboard-item ${isCurrentUser ? 'leaderboard-item-self' : ''}`}
                >
                  <div className="item-rank-section">
                    {isTop3 ? (
                      <Trophy size={16} className={`medal-icon ${getMedalClass(rank)}`} />
                    ) : (
                      <span className="rank-number">{rank}</span>
                    )}
                  </div>

                  <div className="item-user-section">
                    <span className="user-name">
                      {item.author}
                      {isCurrentUser && <span className="self-label"> (You)</span>}
                    </span>
                  </div>

                  <div className="item-score-section">
                    <Badge variant={isTop3 ? 'primary' : 'muted'} className="score-badge">
                      {item.count} {item.count === 1 ? 'Discovery' : 'Discoveries'}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
