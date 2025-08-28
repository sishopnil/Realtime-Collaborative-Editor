import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        rememberMe: { label: 'Remember Me', type: 'checkbox' },
      },
      async authorize(credentials) {
        const base = process.env.NEXT_PUBLIC_API_URL || '';
        const res = await fetch(`${base}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: credentials?.email,
            password: credentials?.password,
            rememberMe: credentials?.rememberMe === 'true',
          }),
          credentials: 'include',
        });
        if (!res.ok) return null;
        const data = await res.json();
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          accessToken: data.accessToken,
        } as any;
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        (token as any).accessToken = (user as any).accessToken;
      }
      // Handle OAuth sign-in by exchanging for backend tokens
      if (account && account.provider !== 'credentials' && profile) {
        try {
          const base = process.env.NEXT_PUBLIC_API_URL || '';
          const resp = await fetch(`${base}/api/auth/oauth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: account.provider,
              email: (profile as any).email,
              name: (profile as any).name,
            }),
            credentials: 'include',
          });
          if (resp.ok) {
            const data = await resp.json();
            (token as any).accessToken = data.accessToken;
          }
        } catch {}
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).accessToken = (token as any).accessToken;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
