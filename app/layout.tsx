import type { Metadata } from 'next';
import './globals.css';
import Shell from '@/components/Shell';
import { StoreProvider } from '@/lib/store';

export const metadata: Metadata = {
  title: 'BSc Nursing & NORCET Study Tracker',
  description: 'Backlog, NORCET, timer, streak aur discipline — sab ek jagah.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <Shell>{children}</Shell>
        </StoreProvider>
      </body>
    </html>
  );
}
