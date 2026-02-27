'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AppUser } from '@/lib/clientStore';
import { getCurrentUser, clearCurrentUser } from '@/lib/clientStore';

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
    // Load from localStorage on mount
    const u = getCurrentUser();
    setUserState(u);
    setLoading(false);
  }, []);

  const setUser = useCallback((u: AppUser | null) => {
    setUserState(u);
  }, []);

  const logout = useCallback(() => {
    clearCurrentUser();
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
