import type { ReactNode } from 'react';
import './canvas.css';
import Icons from '../components/canvas/Icons';
import RoleBar from '../components/role-bar';
import { ToastHost } from '../components/live/toast';

export const metadata = { title: 'Easel prototype' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
          <Icons />
        </div>
        {children}
        <RoleBar />
        <ToastHost />
      </body>
    </html>
  );
}
