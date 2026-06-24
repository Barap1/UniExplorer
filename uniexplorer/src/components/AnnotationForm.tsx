import React, { useState } from 'react';
import { Modal, Input, Textarea, Button } from './ui';
import './AnnotationForm.css';

export interface AnnotationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, details: string) => Promise<void>;
  lat: number;
  lng: number;
}

export const AnnotationForm = ({
  isOpen,
  onClose,
  onSubmit,
  lat,
  lng,
}: AnnotationFormProps) => {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(title.trim(), details.trim());
      setTitle('');
      setDetails('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log New Discovery">
      <form onSubmit={handleSubmit} className="annotation-form">
        <div className="form-coordinates">
          <div className="form-coord-box">
            <span className="coord-lbl">LATITUDE</span>
            <span className="coord-val">{lat.toFixed(6)}°</span>
          </div>
          <div className="form-coord-box">
            <span className="coord-lbl">LONGITUDE</span>
            <span className="coord-val">{lng.toFixed(6)}°</span>
          </div>
        </div>

        <Input
          label="Discovery Name / Title"
          placeholder="e.g., Olympus Mons Rim, Victoria Crater Base"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          disabled={isSubmitting}
        />

        <Textarea
          label="Detailed Observations (Optional)"
          placeholder="Describe geological features, crater depths, terrain texture, or collaborative notes..."
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          disabled={isSubmitting}
        />

        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!title.trim() || isSubmitting}>
            {isSubmitting ? 'Logging...' : 'Log Discovery'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
