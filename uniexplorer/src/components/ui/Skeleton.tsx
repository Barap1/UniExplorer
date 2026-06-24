import './Skeleton.css';

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
}

export const Skeleton = ({ className = '', variant = 'text' }: SkeletonProps) => {
  return (
    <div className={`skeleton skeleton-${variant} ${className}`} />
  );
};
