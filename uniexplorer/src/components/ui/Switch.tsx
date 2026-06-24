import React from 'react';
import './Switch.css';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
}

export const Switch = ({ checked, onChange, label, id }: SwitchProps) => {
  const switchId = React.useId();
  const activeId = id || switchId;

  return (
    <div className="switch-container">
      <button
        type="button"
        id={activeId}
        role="switch"
        aria-checked={checked}
        className={`switch-root ${checked ? 'switch-checked' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className={`switch-thumb ${checked ? 'switch-thumb-checked' : ''}`} />
      </button>
      {label && (
        <label htmlFor={activeId} className="switch-label">
          {label}
        </label>
      )}
    </div>
  );
};
