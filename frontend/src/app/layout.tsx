import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'RishteNate — Temple Matrimony | Mandir',
  description: 'Digital matrimony platform by Mandir, Geeta Colony, Delhi. Register, search matches, and find your life partner with temple blessings.',
  keywords: 'RishteNate, temple matrimony, Hanuman Mandir Geeta Colony, Delhi matrimony',
  icons: {
    icon: '/icons/favicon.ico',
  },
  openGraph: {
    title: 'RishteNate — Temple Matrimony Platform',
    description: 'Find your life partner with the blessings of Hanuman Ji',
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
