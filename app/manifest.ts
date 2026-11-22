import type { MetadataRoute } from 'next';

/**
 * Phase 4 — PWA manifest.
 * Phone me "Add to Home Screen" karne par /public/logo.png app icon ban jayega.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BSc Nursing & NORCET Study Tracker',
    short_name: 'Nursing Tracker',
    description: 'Backlog, NORCET, timer, streak, AI quiz aur panic revision — sab ek jagah.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0d1a',
    theme_color: '#0a0d1a',
    categories: ['education', 'productivity'],
    icons: [
      {
        src: '/logo.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
