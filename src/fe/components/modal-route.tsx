'use client';

import { type MouseEvent, type ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRoute } from '../lib/nav';

export default function ModalRoute({ closeTo, children, className = '' }: { closeTo: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  const route = useRoute();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      router.push(route(closeTo));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeTo, route, router]);
  const closeOnBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) router.push(route(closeTo));
  };
  return <div className={`scrim ${className}`.trim()} role="presentation" onMouseDown={closeOnBackdrop}>{children}</div>;
}
