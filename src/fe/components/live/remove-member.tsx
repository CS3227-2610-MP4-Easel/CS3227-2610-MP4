'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RemoveMemberDialog } from './flows';

function Inner() {
  const id = useSearchParams().get('member') || 'u4';
  return <RemoveMemberDialog memberId={id} />;
}

export default function RemoveMember() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
