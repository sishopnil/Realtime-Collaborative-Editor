'use client';
import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState(false);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await signIn('credentials', {
      email,
      password,
      rememberMe: String(remember),
      redirect: false,
    });
    if (res?.ok) router.push('/');
    else setError('Invalid email or password');
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Login</h1>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <button onClick={() => signIn('github')}>Continue with GitHub</button>
        <button onClick={() => signIn('google')}>Continue with Google</button>
      </div>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />{' '}
          Remember me
        </label>
        <button type="submit">Sign in</button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
    </main>
  );
}
