import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Manrope, Russo_One } from 'next/font/google'
import './globals.css'

const manrope = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-manrope' })
const russo = Russo_One({ subsets: ['latin', 'cyrillic'], weight: '400', variable: '--font-russo' })

export const metadata: Metadata = {
  title: 'Авто-Нотариус: Неоновый Перекуп',
  description:
    'Мобильная инди-игра про перекупщика машин: осмотр тачек, торг, аукционы, тюнинг, теневые схемы и экзамены на лицензию Авто-Нотариуса.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0f0c1d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" data-theme="neon" suppressHydrationWarning className={`${manrope.variable} ${russo.variable} dark bg-background`}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
