import type { Metadata } from 'next';
import './globals.css';
import { LangProvider } from '@/components/LangContext';
import { AuthProvider } from '@/components/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'MEafterMe — Цифрово наследство за бъдещите поколения',
  description:
    'Запазете историите на живота си с AI аватар. MEafterMe помага на семействата да съхранят спомени, глас и мъдрост за бъдещите поколения.',
  metadataBase: new URL(process.env.APP_URL || 'https://afterme.life'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: 'MEafterMe',
    title: 'MEafterMe — Цифрово наследство',
    description:
      'Запазете историите на живота си с AI аватар за бъдещите поколения.',
    url: 'https://afterme.life',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex flex-col min-h-screen" style={{ backgroundColor: 'hsl(30 15% 7%)', color: 'hsl(38 50% 92%)' }}>
        <LangProvider>
          <AuthProvider>
            <Header />
            <main className="flex-1 pt-16">
              {children}
            </main>
            <Footer />
          </AuthProvider>
        </LangProvider>
      </body>
    </html>
  );
}
