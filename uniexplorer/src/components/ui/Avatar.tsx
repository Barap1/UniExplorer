import React from 'react';
import './Avatar.css';

export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar = ({ src, name, size = 'md', className = '' }: AvatarProps) => {
  const initials = name
    ? name
        .split(' ')
        .map((n: string) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <div className={`avatar avatar-${size} ${className}`}>
      {src ? (
        <img src={src} alt={name || 'Avatar'} className="avatar-img" />
      ) : (
        <div className="avatar-fallback">{initials}</div>
      )}
    </div>
  );
};
