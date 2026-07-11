import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Relay',
  description: 'AI-human task relay and agent handoff board',
  appleWebApp: {
    capable: true,
    title: 'Relay',
    statusBarStyle: 'black',
  },
}

export const viewport: Viewport = {
  themeColor: '#03060b',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
