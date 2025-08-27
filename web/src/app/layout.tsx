import { SWRConfig } from 'swr';
import { AuthProvider } from '../providers/AuthProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <SWRConfig value={{ fetcher: (url: string) => fetch(url).then((r) => r.json()) }}>
          <AuthProvider>{children}</AuthProvider>
        </SWRConfig>
      </body>
    </html>
  );
}
