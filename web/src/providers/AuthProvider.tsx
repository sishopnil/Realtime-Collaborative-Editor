"use client";
import React, { createContext, useContext, useMemo, useState } from 'react';

type AuthState = { user: { id: string; email: string } | null; signOut: () => void };

const AuthContext = createContext<AuthState>({ user: null, signOut: () => {} });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthState['user']>(null);
  const value = useMemo(() => ({ user, signOut: () => setUser(null) }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

