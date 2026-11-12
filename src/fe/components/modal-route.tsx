'use client';

import { type MouseEvent, type ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useModal, useRoute } from '../lib/nav';

export default function ModalRoute({ closeTo, children, className = '' }: { closeTo: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  const route = useRoute();
  const modal = useModal();
  const close = () => modal.modal ? modal.close() : router.push(route(closeTo));
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeTo, route, router, modal.modal]);
  const closeOnBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };
  return <div className={`scrim ${className}`.trim()} role="presentation" onMouseDown={closeOnBackdrop}>{children}</div>;
}
