'use client';
import React from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function ProtectedPage() {
  const { status } = useSession();
  if (status === 'loading') return <p>Loading...</p>;
  if (status !== 'authenticated')
    return (
      <main style={{ padding: 24 }}>
        <p>
          Unauthorized. Please <Link href="/login">login</Link>.
        </p>
      </main>
    );
  return (
    <main style={{ padding: 24 }}>
      <h1>Protected Area</h1>
      <p>You are authenticated.</p>
    </main>
  );
}
