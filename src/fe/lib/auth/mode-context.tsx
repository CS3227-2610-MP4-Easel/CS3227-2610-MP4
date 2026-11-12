'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { AuthMode } from './mode';
import { firebaseConfigured } from './firebase';
import { SessionProvider } from './session';

export const AuthModeCtx = createContext<AuthMode>('prototype');

export const useAuthMode = (): AuthMode => useContext(AuthModeCtx);

export function AuthRoot({ mode, children }: { mode: AuthMode; children: ReactNode }) {
  if (mode === 'unconfigured' || (mode === 'firebase' && !firebaseConfigured())) {
    return (
      <main className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p>Sign-in is not configured for this deployment.</p>
      </main>
    );
  }
  return (
    <AuthModeCtx.Provider value={mode}>
      {mode === 'firebase' ? <SessionProvider>{children}</SessionProvider> : children}
    </AuthModeCtx.Provider>
  );
}
