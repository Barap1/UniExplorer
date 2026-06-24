import { useEffect } from 'react';
import './Toast.css';

export interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export const Toast = ({ message, onClose, duration = 3000 }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  if (!message) return null;

  return (
    <div className="toast-container">
      <div className="toast-card">
        <div className="toast-stripe" />
        <div className="toast-content">{message}</div>
      </div>
    </div>
  );
};
