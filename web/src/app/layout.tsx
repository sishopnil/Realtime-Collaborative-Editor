'use client';

import { SWRConfig } from 'swr';
import { AuthProvider } from '../providers/AuthProvider';
import { SessionProvider } from 'next-auth/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <SWRConfig value={{ fetcher: (url: string) => fetch(url).then((r) => r.json()) }}>
          <SessionProvider>
            <AuthProvider>{children}</AuthProvider>
          </SessionProvider>
        </SWRConfig>
      </body>
    </html>
  );
}
