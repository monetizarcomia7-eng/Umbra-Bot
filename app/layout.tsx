import type {Metadata} from 'next';
import './globals.css';
import { ThemeProvider } from 'next-themes'

export const metadata: Metadata = {
  title: 'Umbra Bot - Automação e Vendas no Telegram',
  description: 'Plataforma multi-tenant de automação e vendas no Telegram.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
