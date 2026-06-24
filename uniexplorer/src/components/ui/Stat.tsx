import React from 'react';
import './Stat.css';

export interface StatProps {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  className?: string;
}

export const Stat = ({ value, label, icon, className = '' }: StatProps) => {
  return (
    <div className={`stat-card ${className}`}>
      {icon && <div className="stat-icon">{icon}</div>}
      <div className="stat-details">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
};
