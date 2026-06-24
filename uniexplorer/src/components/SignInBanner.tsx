import { Card, Button } from './ui';
import { GoogleIcon } from './Icons';
import './SignInBanner.css';

export interface SignInBannerProps {
  onSignIn: () => void;
}

export const SignInBanner = ({ onSignIn }: SignInBannerProps) => {
  return (
    <div className="signin-banner-container animate-fade-in">
      <Card variant="accent-border" className="signin-banner-card">
        <h4 className="signin-banner-title">Collaborative Logging</h4>
        <p className="signin-banner-text">
          Sign in to log observations on map terrain coordinates and track explorer achievements.
        </p>
        <Button variant="primary" onClick={onSignIn} className="signin-banner-btn">
          <GoogleIcon size={14} style={{ marginRight: '4px' }} />
          <span>Sign In with Google</span>
        </Button>
      </Card>
    </div>
  );
};
