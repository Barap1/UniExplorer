import { useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const useAuth = (showToast: (msg: string) => void) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      showToast(`Welcome, ${result.user.displayName}!`);
    } catch (error) {
      console.error('Sign in failed', error);
      showToast('Sign in failed');
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      showToast('Signed out');
    } catch (error) {
      console.error('Sign out failed', error);
      showToast('Sign out failed');
    }
  };

  return { user, loading, signIn, signOut };
};
