import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from 'next-themes'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { PostHogProvider } from '@/providers/PostHogProvider'
import { ServiceWorkerRegistrar } from './ServiceWorkerRegistrar'

export const metadata: Metadata = {
  title: 'Umbra Bot - Automação e Vendas no Telegram',
  description: 'Plataforma multi-tenant de automação e vendas no Telegram.',
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
