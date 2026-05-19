import { createClient } from '@/lib/supabase/server'
import { ApplicationForm } from './ApplicationForm'
import { Check } from 'lucide-react'

interface PublicProgram {
  found: boolean
  active: boolean
  program_name: string
  program_description: string
  benefits: string[]
  percentage: number
  cookie_window: number
  upsell_commissions: boolean
  recurring_commissions: boolean
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function ProgramNotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <div className="text-[40px] mb-4">☁️</div>
      <div className="text-[20px] font-semibold text-text mb-2">Programa não encontrado</div>
      <div className="text-[14px] text-text-muted max-w-xs">
        Este link de afiliados não existe ou foi desativado pelo criador.
      </div>
    </div>
  )
}

function ProgramClosed({ name }: { name: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <div className="text-[40px] mb-4">🔒</div>
      <div className="text-[20px] font-semibold text-text mb-2">Programa fechado</div>
      <div className="text-[14px] text-text-muted max-w-xs">
        {name
          ? <><strong className="text-text">{name}</strong> não está aceitando novas candidaturas no momento.</>
          : 'Este programa de afiliados não está aceitando novas candidaturas no momento.'}
      </div>
    </div>
  )
}

export default async function AfiliarPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params

  if (!UUID_RE.test(userId)) return <ProgramNotFound />

  const supabase = await createClient()
  const { data: program } = await supabase.rpc('get_public_affiliate_program', { p_user_id: userId })

  const p = program as PublicProgram | null
  if (!p || !p.found) return <ProgramNotFound />
  if (!p.active) return <ProgramClosed name={p.program_name} />

  const programName = p.program_name || 'Programa de Afiliados'
  const programDescription = p.program_description || 'Divulgue nossos produtos e ganhe comissão por cada venda confirmada.'

  const benefits: string[] = p.benefits && p.benefits.length > 0
    ? p.benefits
    : [
        `Cookie de ${p.cookie_window} dias`,
        'Pagamento via Pix',
        ...(p.upsell_commissions ? ['Comissão em upsells'] : []),
        ...(p.recurring_commissions ? ['Comissão em renovações'] : []),
        'Relatórios de cliques e vendas em tempo real',
        'Link exclusivo de divulgação',
      ]

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start pt-12 pb-16 px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 text-[20px] font-bold text-text mb-1">
          ☁️ Umbra Bot
        </div>
        <div className="text-[12px] text-text-muted">Plataforma de vendas por Telegram</div>
      </div>

      <div className="w-full max-w-md">
        {/* Commission hero */}
        <div className="bg-primary rounded-2xl px-6 py-8 text-center mb-4 shadow-lg">
          <div className="text-[13px] font-semibold text-primary-fg/70 uppercase tracking-wider mb-2">
            {programName}
          </div>
          <div className="text-[64px] font-bold text-primary-fg leading-none tracking-tight">
            {p.percentage}%
          </div>
          <div className="text-[15px] text-primary-fg/80 mt-2">de comissão por venda confirmada</div>
        </div>

        {/* Description */}
        {programDescription && (
          <div className="bg-surface border border-border rounded-2xl px-5 py-4 mb-4 text-[13px] text-text-muted leading-relaxed">
            {programDescription}
          </div>
        )}

        {/* Benefits */}
        <div className="bg-surface border border-border rounded-2xl p-5 mb-4">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-text-subtle mb-3">
            O que você recebe
          </div>
          <ul className="space-y-2">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-[13px] text-text">
                <span className="w-5 h-5 rounded-full bg-success-soft text-success flex items-center justify-center shrink-0">
                  <Check size={11} strokeWidth={2.5} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Application form */}
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="text-[15px] font-semibold text-text mb-1">Quero ser afiliado</div>
          <div className="text-[12.5px] text-text-muted mb-4">
            Preencha seus dados e aguarde o contato do criador do programa.
          </div>
          <ApplicationForm userId={userId} />
        </div>

        <div className="mt-6 text-center text-[11.5px] text-text-subtle">
          Programa gerenciado com{' '}
          <span className="font-medium text-text-muted">Umbra Bot</span>
        </div>
      </div>
    </div>
  )
}
