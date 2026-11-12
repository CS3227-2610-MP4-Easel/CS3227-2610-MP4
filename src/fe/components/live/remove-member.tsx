'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useModal } from '../../lib/nav';
import { RemoveMemberDialog } from './flows';

function Inner() {
  const modal = useModal();
  const id = modal.modal?.params?.member || useSearchParams().get('member') || 'u4';
  return <RemoveMemberDialog memberId={id} />;
}

export default function RemoveMember() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
