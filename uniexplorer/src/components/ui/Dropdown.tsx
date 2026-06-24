import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from '../Icons';
import './Dropdown.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export const Select = ({ options, value, onChange, label, className = '' }: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`select-group ${className}`} ref={containerRef}>
      {label && <span className="select-label">{label}</span>}
      <div className="select-wrapper">
        <button
          type="button"
          className="select-trigger"
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span>{selectedOption?.label}</span>
          <ChevronDown size={16} className={`select-arrow ${isOpen ? 'select-arrow-open' : ''}`} />
        </button>

        {isOpen && (
          <ul className="select-dropdown animate-fade-in" role="listbox">
            {options.map((option) => (
              <li
                key={option.value}
                className={`select-option ${option.value === value ? 'select-option-active' : ''}`}
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
