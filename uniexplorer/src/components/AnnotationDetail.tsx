import { Modal, Badge, Button } from './ui';
import { User, Map } from './Icons';
import './AnnotationDetail.css';

export interface Annotation {
  id: string;
  lat: number;
  lng: number;
  text: string;
  details?: string;
  author: string;
  celestialBody: string;
}

export interface AnnotationDetailProps {
  isOpen: boolean;
  onClose: () => void;
  annotation: Annotation | null;
  currentUser: { displayName: string | null; email: string | null } | null;
}

export const AnnotationDetail = ({
  isOpen,
  onClose,
  annotation,
  currentUser,
}: AnnotationDetailProps) => {
  if (!annotation) return null;

  const currentUserName = currentUser ? (currentUser.displayName ?? currentUser.email ?? 'Unknown') : null;
  const isOwner = currentUserName && annotation.author === currentUserName;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Discovery Scan">
      <div className="annotation-detail-container">
        <div className="detail-header-block">
          <Badge variant={isOwner ? 'primary' : 'muted'} className="owner-badge">
            <User size={12} style={{ marginRight: '4px' }} />
            <span>{annotation.author} {isOwner && '(You)'}</span>
          </Badge>
          <Badge variant="accent" className="planet-badge">
            <Map size={12} style={{ marginRight: '4px' }} />
            <span>{annotation.celestialBody}</span>
          </Badge>
        </div>

        <h3 className="detail-title">{annotation.text}</h3>

        {annotation.details && (
          <div className="detail-observations">
            <div className="observations-label">OBSERVATIONS</div>
            <p className="observations-text">{annotation.details}</p>
          </div>
        )}

        <div className="detail-coordinates">
          <div className="detail-coord-box">
            <span className="coord-lbl">LATITUDE</span>
            <span className="coord-val">{annotation.lat.toFixed(6)}°</span>
          </div>
          <div className="detail-coord-box">
            <span className="coord-lbl">LONGITUDE</span>
            <span className="coord-val">{annotation.lng.toFixed(6)}°</span>
          </div>
        </div>

        <div className="detail-footer">
          <Button variant="secondary" onClick={onClose} className="w-full">
            Close Scan
          </Button>
        </div>
      </div>
    </Modal>
  );
};
