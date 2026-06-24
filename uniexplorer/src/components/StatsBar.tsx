import { Stat } from './ui';
import { Eye, Trophy, User } from './Icons';
import './StatsBar.css';

export interface StatsBarProps {
  totalDiscoveries: number;
  totalExplorers: number;
  yourRank: number;
  activeBodyName: string;
}

export const StatsBar = ({
  totalDiscoveries,
  totalExplorers,
  yourRank,
  activeBodyName,
}: StatsBarProps) => {
  return (
    <div className="stats-bar animate-fade-in">
      <Stat
        value={totalDiscoveries}
        label={`Discoveries on ${activeBodyName}`}
        icon={<Eye size={16} />}
        className="stats-bar-item"
      />
      <Stat
        value={totalExplorers}
        label="Global Explorers"
        icon={<User size={16} />}
        className="stats-bar-item"
      />
      <Stat
        value={yourRank > 0 ? `#${yourRank}` : 'N/A'}
        label="Your Rank"
        icon={<Trophy size={16} />}
        className="stats-bar-item"
      />
    </div>
  );
};
