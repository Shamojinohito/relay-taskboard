import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Relay',
    short_name: 'Relay',
    description: 'AI-human task relay and agent handoff board',
    start_url: '/',
    display: 'standalone',
    background_color: '#03060b',
    theme_color: '#03060b',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
