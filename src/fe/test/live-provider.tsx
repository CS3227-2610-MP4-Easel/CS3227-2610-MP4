import type { ReactNode } from 'react';
import { AuthModeCtx } from '../lib/auth/mode-context';

// Renders children in `firebase` auth mode without AuthRoot's config check or session provider.
// Tests also mock '../lib/auth/firebase' (idToken resolves 't') and next/navigation's usePathname.
export function LiveTestProvider({ children }: { children: ReactNode }) {
  return <AuthModeCtx.Provider value="firebase">{children}</AuthModeCtx.Provider>;
}
