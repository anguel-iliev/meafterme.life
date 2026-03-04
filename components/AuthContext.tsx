'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AppUser } from '@/lib/clientStore';
import { getCurrentUser, clearCurrentUser, findOrCreateClientUserByUid, saveCurrentUser, signOutUser } from '@/lib/clientStore';
import { isFirebaseClientConfigured, getClientAuth } from '@/lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  setUser: (u: AppUser | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, loading: true,
  setUser: () => {}, logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isFirebaseClientConfigured()) {
      const auth = getClientAuth();
      const unsub = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser && fbUser.emailVerified) {
          try {
            const appUser = await findOrCreateClientUserByUid(fbUser.uid, fbUser.email!);
            saveCurrentUser(appUser);
            setUserState(appUser);
          } catch {
            setUserState(getCurrentUser());
          }
        } else if (fbUser && !fbUser.emailVerified) {
          setUserState(null);
        } else {
          setUserState(getCurrentUser());
        }
        setLoading(false);
      });
      return () => unsub();
    } else {
      setUserState(getCurrentUser());
      setLoading(false);
    }
  }, []);

  const setUser = useCallback((u: AppUser | null) => setUserState(u), []);

  const logout = useCallback(async () => {
    await signOutUser();
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
