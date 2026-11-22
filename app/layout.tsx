import type { Metadata, Viewport } from 'next';
import './globals.css';
import Shell from '@/components/Shell';
import SplashScreen from '@/components/SplashScreen';
import { StoreProvider } from '@/lib/store';

export const metadata: Metadata = {
  title: 'BSc Nursing & NORCET Study Tracker',
  description: 'Backlog, NORCET, timer, streak, AI quiz aur discipline — sab ek jagah.',
  applicationName: 'Nursing Tracker',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png', sizes: '1024x1024' },
      { url: '/logo.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/logo.png', type: 'image/png' }],
    shortcut: ['/logo.png'],
  },
  appleWebApp: {
    capable: true,
    title: 'Nursing Tracker',
    statusBarStyle: 'black-translucent',
  },
  other: { 'mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  themeColor: '#0a0d1a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <SplashScreen />
          <Shell>{children}</Shell>
        </StoreProvider>
      </body>
    </html>
  );
}
