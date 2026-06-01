import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InstagramTabs from '@/components/instagram/InstagramTabs'

export default async function InstagramLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Auth guard compartilhado pra todas as rotas do módulo
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <>
      <div className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-[1400px] mx-auto px-4 pt-6 pb-0">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
              Instagram
            </h1>
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Agende posts, reels e carrosséis nas suas contas do Instagram.
          </p>
          <InstagramTabs />
        </div>
      </div>

      {children}
    </>
  )
}
