'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, me_4, type ApiRole, type User } from '../api';
import type { Role } from '../screens';
import { onUserChanged, signOutUser } from './firebase';
import { hardNavigate } from './navigate';

export type SessionStatus = 'loading' | 'signed-out' | 'unregistered' | 'ready' | 'error';
export type Session = {
  status: SessionStatus;
  user: User | null;
  firebaseEmail: string | null;
  error: ApiError | null;
  retry(): void;
  setUser(u: User): void;
  holdForRegistration(): () => void;
  signOut(): Promise<void>;
};

const SessionCtx = createContext<Session | null>(null);

export const useSession = (): Session | null => useContext(SessionCtx);

export function toRole(r: ApiRole): Role {
  return r === 'PM' ? 'pm' : r === 'DEV_LEAD' ? 'lead' : 'dev';
}

export const ROLE_LABEL: Record<ApiRole, string> = { PM: 'Project Manager', DEV_LEAD: 'Dev Lead', DEVELOPER: 'Developer' };

export function initialsOf(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!words.length) return '?';
  return words.map((w) => String.fromCodePoint(w.codePointAt(0) as number)).join('').toUpperCase();
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUserState] = useState<User | null>(null);
  const [firebaseEmail, setFirebaseEmail] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const gen = useRef(0);
  const holds = useRef(0);
  const hadUser = useRef(false);

  const load = useCallback((g: number) => {
    setStatus('loading');
    me_4().then(
      (u) => {
        if (g !== gen.current) return;
        setUserState(u);
        setError(null);
        setStatus('ready');
      },
      (e: unknown) => {
        if (g !== gen.current) return;
        if (e instanceof ApiError && e.status === 401) return;
        if (e instanceof ApiError && e.code === 'USER_NOT_REGISTERED') {
          setStatus('unregistered');
          return;
        }
        setError(e instanceof ApiError ? e : new ApiError('UNKNOWN', 'Something went wrong.'));
        setStatus('error');
      },
    );
  }, []);

  useEffect(() => {
    const unsub = onUserChanged((u) => {
      const g = ++gen.current;
      if (!u) {
        hadUser.current = false;
        setUserState(null);
        setFirebaseEmail(null);
        setStatus('signed-out');
        return;
      }
      const was = hadUser.current;
      hadUser.current = true;
      setFirebaseEmail(u.email);
      if (holds.current > 0 && !was) return;
      load(g);
    });
    return () => {
      gen.current++;
      unsub();
    };
  }, [load]);

  const value = useMemo<Session>(
    () => ({
      status,
      user,
      firebaseEmail,
      error,
      retry: () => load(gen.current),
      setUser: (u) => {
        gen.current++;
        setUserState(u);
        setError(null);
        setStatus('ready');
      },
      holdForRegistration: () => {
        holds.current++;
        let released = false;
        return () => {
          if (released) return;
          released = true;
          holds.current--;
        };
      },
      signOut: async () => {
        try {
          await signOutUser();
        } finally {
          hardNavigate('/sign-in');
        }
      },
    }),
    [status, user, firebaseEmail, error, load],
  );

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}
