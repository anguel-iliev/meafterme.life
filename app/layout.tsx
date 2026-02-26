import type { Metadata } from 'next';
import './globals.css';
import { LangProvider } from '@/components/LangContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'MEafterMe — Preserve their stories for generations',
  description:
    'Record real video answers, organize memories, and build a private legacy your family can revisit forever.',
  metadataBase: new URL(process.env.APP_URL || 'https://afterme.life'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: 'MEafterMe',
    title: 'MEafterMe — Preserve their stories for generations',
    description:
      'Record real video answers, organize memories, and build a private legacy your family can revisit forever.',
    url: 'https://afterme.life',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex flex-col min-h-screen bg-white text-gray-900">
        <LangProvider>
          <Header />
          <main className="flex-1 pt-16">
            {children}
          </main>
          <Footer />
        </LangProvider>
      </body>
    </html>
  );
}
