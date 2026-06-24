import React from 'react';
import './Input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, ...props }, ref) => {
    return (
      <div className="input-group">
        {label && <label className="input-label">{label}</label>}
        <input ref={ref} className={`input-field ${error ? 'input-error' : ''} ${className}`} {...props} />
        {error && <span className="input-error-msg">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', label, error, ...props }, ref) => {
    return (
      <div className="input-group">
        {label && <label className="input-label">{label}</label>}
        <textarea ref={ref} className={`textarea-field ${error ? 'input-error' : ''} ${className}`} {...props} />
        {error && <span className="input-error-msg">{error}</span>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
