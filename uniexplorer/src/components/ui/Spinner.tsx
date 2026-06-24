import { Compass } from '../Icons';
import './Spinner.css';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Spinner = ({ size = 'md', className = '' }: SpinnerProps) => {
  const pixelSize = size === 'sm' ? 20 : size === 'md' ? 36 : 56;
  return (
    <div className={`spinner-container ${className}`}>
      <Compass size={pixelSize} className="spinner-icon animate-compass-spin" />
    </div>
  );
};
