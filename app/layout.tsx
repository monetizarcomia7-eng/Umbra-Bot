import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from 'next-themes'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { PostHogProvider } from '@/providers/PostHogProvider'
import { ServiceWorkerRegistrar } from './ServiceWorkerRegistrar'

const APP_URL = process.env.APP_URL ?? 'https://www.umbrabot.com.br'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Umbra Bot — Venda no Telegram no automático',
    template: '%s — Umbra Bot',
  },
  description: 'Plataforma de automação e vendas no Telegram. Sem mensalidade. Só paga quando vende.',
  applicationName: 'Umbra Bot',
  keywords: ['telegram', 'bot', 'vendas', 'automação', 'pix', 'infoproduto', 'chatbot'],
  authors: [{ name: 'Umbra Bot', url: APP_URL }],
  creator: 'Umbra Bot',
  publisher: 'Umbra Bot',
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.svg', type: 'image/svg+xml', sizes: '180x180' },
    ],
    shortcut: '/favicon.svg',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: APP_URL,
    siteName: 'Umbra Bot',
    title: 'Umbra Bot — Venda no Telegram no automático',
    description: 'Sem mensalidade. Só paga quando vende.',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Umbra Bot — Venda no Telegram no automático',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Umbra Bot — Venda no Telegram no automático',
    description: 'Sem mensalidade. Só paga quando vende.',
    images: ['/og-image.svg'],
    creator: '@umbrabot',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0E0F13' },
    { media: '(prefers-color-scheme: light)', color: '#F7F8FA' },
  ],
  colorScheme: 'dark light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
          <PostHogProvider>
            <ServiceWorkerRegistrar />
            {children}
          </PostHogProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
