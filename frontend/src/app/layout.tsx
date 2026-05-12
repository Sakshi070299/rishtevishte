import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'TheMarriageHome.com — Find Your Forever Home',
  description: 'Premium matrimony platform. Register, search matches, and find your life partner. TheMarriageHome.com — Find Your Forever Home.',
  keywords: 'TheMarriageHome, matrimony, marriage, matchmaking, life partner, wedding',
  icons: {
    icon: '/icons/favicon.ico',
  },
  openGraph: {
    title: 'TheMarriageHome.com — Find Your Forever Home',
    description: 'Find your life partner with TheMarriageHome.com',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
