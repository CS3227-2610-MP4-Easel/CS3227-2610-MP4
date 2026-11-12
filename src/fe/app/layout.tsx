import type { ReactNode } from 'react';
import './canvas.css';
import Icons from '../components/canvas/Icons';
import RoleBar from '../components/role-bar';
import { ToastHost } from '../components/live/toast';
import { ModeProvider } from '../lib/api';
import { authMode } from '../lib/auth/mode';
import { AuthRoot } from '../lib/auth/mode-context';

export const metadata = { title: 'Easel prototype' };
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: ReactNode }) {
  const mode = authMode(process.env);
  return (
    <html lang="en">
      <body>
        <div aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
          <Icons />
        </div>
        <AuthRoot mode={mode}>
          <ModeProvider live={process.env.LLM_MODE === 'live'}>{children}</ModeProvider>
          <RoleBar />
        </AuthRoot>
        <ToastHost />
      </body>
    </html>
  );
}
