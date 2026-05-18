'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Mail, Send, AlertCircle, UserCheck, Clock, CheckCircle, ChevronDown } from 'lucide-react'
import { LegalLayout, TocItem } from '@/components/legal/LegalLayout'

const toc: TocItem[] = [
  { id: 'canais',   label: 'Canais de Atendimento' },
  { id: 'form',     label: 'Formulário de Contato' },
  { id: 'horarios', label: 'Horários e SLA' },
  { id: 'empresa',  label: 'Identificação da Empresa' },
  { id: 'links',    label: 'Links Úteis' },
]

function Ph({ t }: { t: string }) {
  return <strong className="text-primary font-semibold">[{t}]</strong>
}

function Bold({ children }: { children: React.ReactNode }) {
  return <strong className="text-text font-semibold">{children}</strong>
}

interface ContactCardProps {
  icon: React.ElementType
  title: string
  description: string
  value: React.ReactNode
  badge?: string
  badgeColor?: 'primary' | 'success' | 'warning' | 'danger'
}

function ContactCard({ icon: Icon, title, description, value, badge, badgeColor = 'primary' }: ContactCardProps) {
  const badgeClass = {
    primary: 'bg-primary-soft text-primary',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
  }[badgeColor]

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <Icon size={20} className="text-primary" />
        </div>
        {badge && (
          <span className={`text-[10.5px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${badgeClass}`}>
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="text-[14px] font-semibold text-text">{title}</p>
        <p className="text-[12.5px] text-text-muted mt-0.5 leading-[1.6]">{description}</p>
      </div>
      <div className="text-[13px] text-primary font-medium break-all">{value}</div>
    </div>
  )
}

const SUBJECTS = [
  'Dúvida sobre a Plataforma',
  'Problema técnico / Bug',
  'Faturamento e pagamentos',
  'Cancelamento de conta',
  'Solicitação de dados (LGPD)',
  'Parceria ou integração',
  'Reportar conteúdo impróprio',
  'Outro',
]

interface FormState {
  name: string
  email: string
  subject: string
  message: string
}

interface FormErrors {
  name?: string
  email?: string
  subject?: string
  message?: string
}

function ContactForm() {
  const [form, setForm] = useState<FormState>({ name: '', email: '', subject: '', message: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)

  const validate = (): boolean => {
    const e: FormErrors = {}
    if (!form.name.trim()) e.name = 'Nome obrigatório.'
    if (!form.email.trim()) e.email = 'E-mail obrigatório.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'E-mail inválido.'
    if (!form.subject) e.subject = 'Selecione um assunto.'
    if (!form.message.trim()) e.message = 'Mensagem obrigatória.'
    else if (form.message.trim().length < 20) e.message = 'Mínimo 20 caracteres.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setSending(true)
    setTimeout(() => {
      setSending(false)
      setSubmitted(true)
    }, 1200)
  }

  const field = (
    id: keyof FormState,
    label: string,
    el: React.ReactNode,
  ) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-text">{label}</label>
      {el}
      {errors[id] && (
        <span className="flex items-center gap-1.5 text-[12px] text-danger">
          <AlertCircle size={12} />
          {errors[id]}
        </span>
      )}
    </div>
  )

  const inputCls = (err?: string) =>
    `w-full rounded-xl border ${err ? 'border-danger' : 'border-border'} bg-surface-2 px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 ${err ? 'focus:ring-danger/30' : 'focus:ring-primary/30'} transition`

  if (submitted) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success-soft/20 px-6 py-8 flex flex-col items-center text-center gap-3">
        <CheckCircle size={40} className="text-success" />
        <h3 className="text-[16px] font-semibold text-text">Mensagem enviada!</h3>
        <p className="text-[13.5px] text-text-muted max-w-xs leading-[1.7]">
          Recebemos sua mensagem e retornaremos para <Bold>{form.email}</Bold> em até 2 dias úteis.
        </p>
        <button
          onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }) }}
          className="mt-2 text-[13px] text-primary hover:underline"
        >
          Enviar outra mensagem
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        {field('name', 'Nome completo *', (
          <input
            id="name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Seu nome"
            className={inputCls(errors.name)}
          />
        ))}
        {field('email', 'E-mail *', (
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="voce@exemplo.com"
            className={inputCls(errors.email)}
          />
        ))}
      </div>

      {field('subject', 'Assunto *', (
        <div className="relative">
          <select
            id="subject"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            className={`${inputCls(errors.subject)} appearance-none pr-9`}
          >
            <option value="">Selecione um assunto…</option>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
      ))}

      {field('message', 'Mensagem *', (
        <textarea
          id="message"
          rows={5}
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          placeholder="Descreva sua dúvida ou problema com o máximo de detalhes possível…"
          className={`${inputCls(errors.message)} resize-y min-h-[120px]`}
        />
      ))}

      <div className="flex items-center gap-2 text-[12px] text-text-muted">
        <AlertCircle size={13} className="text-text-subtle shrink-0" />
        <span>
          Ao enviar, você concorda com nossa{' '}
          <Link href="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>.
          {' '}Não inclua dados sensíveis desnecessários.
        </span>
      </div>

      <button
        type="submit"
        disabled={sending}
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-fg text-[14px] font-semibold hover:opacity-90 active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {sending ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Enviando…
          </>
        ) : (
          <>
            <Send size={15} />
            Enviar mensagem
          </>
        )}
      </button>

      <p className="text-[11.5px] text-text-subtle">
        * Campos obrigatórios. O formulário ainda não está integrado a um backend — a integração deve ser
        configurada com <strong>[SERVIÇO DE E-MAIL / API]</strong> antes de entrar em produção.
      </p>
    </form>
  )
}

export default function ContatoPage() {
  return (
    <LegalLayout
      title="Fale Conosco"
      lastUpdated="18 de maio de 2026"
      toc={toc}
    >
      {/* Channels */}
      <section id="canais" style={{ scrollMarginTop: '72px' }} className="mb-10">
        <h2 className="text-[17px] md:text-[19px] font-semibold text-text mb-2">Canais de Atendimento</h2>
        <p className="text-[14px] text-text-muted mb-5 leading-[1.75]">
          Escolha o canal mais adequado para sua necessidade. Nossa equipe está pronta para ajudar.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <ContactCard
            icon={Mail}
            title="Suporte Geral"
            description="Dúvidas sobre a plataforma, cobranças e funcionalidades."
            value={<Ph t="E-MAIL DE SUPORTE" />}
            badge="Principal"
            badgeColor="primary"
          />
          <ContactCard
            icon={Send}
            title="Suporte via Telegram"
            description="Atendimento em tempo real pelo nosso bot de suporte oficial."
            value={<Ph t="LINK DO SUPORTE NO TELEGRAM" />}
            badge="Mais rápido"
            badgeColor="success"
          />
          <ContactCard
            icon={AlertCircle}
            title="Denúncias e Abuso"
            description="Reportar conteúdo ilegal, spam ou uso indevido da plataforma."
            value={<Ph t="E-MAIL DE DENÚNCIAS" />}
            badge="Urgente"
            badgeColor="danger"
          />
          <ContactCard
            icon={UserCheck}
            title="Encarregado (DPO)"
            description="Solicitações de dados pessoais, LGPD e privacidade."
            value={<Ph t="E-MAIL DO ENCARREGADO" />}
            badge="LGPD"
            badgeColor="warning"
          />
        </div>
      </section>

      {/* Form */}
      <section id="form" style={{ scrollMarginTop: '72px' }} className="mb-10">
        <h2 className="text-[17px] md:text-[19px] font-semibold text-text mb-2">Formulário de Contato</h2>
        <p className="text-[14px] text-text-muted mb-5 leading-[1.75]">
          Prefere escrever? Preencha o formulário abaixo e retornaremos por e-mail.
        </p>
        <div className="rounded-2xl border border-border bg-surface p-5 md:p-6">
          <ContactForm />
        </div>
      </section>

      {/* Hours & SLA */}
      <section id="horarios" style={{ scrollMarginTop: '72px' }} className="mb-10">
        <h2 className="text-[17px] md:text-[19px] font-semibold text-text mb-4 flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary text-[12px] font-bold shrink-0">
            <Clock size={14} />
          </span>
          Horários e Tempo de Resposta
        </h2>
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-[13.5px] text-text-muted leading-[1.75]">
              Nosso horário de atendimento é <Bold><Ph t="HORÁRIO DE ATENDIMENTO" /></Bold>. Mensagens recebidas
              fora desse horário serão respondidas no próximo dia útil.
            </p>
          </div>
          <div className="divide-y divide-border">
            {[
              { canal: 'Suporte via Telegram', sla: 'Até 4 horas (horário comercial)', badge: '⚡ Rápido' },
              { canal: 'E-mail de Suporte Geral', sla: 'Até 2 dias úteis', badge: '' },
              { canal: 'E-mail de Denúncias', sla: 'Até 24 horas (urgências imediatas)', badge: '🚨 Prioridade' },
              { canal: 'Encarregado (DPO / LGPD)', sla: 'Até 15 dias corridos (prazo legal)', badge: '' },
            ].map((row) => (
              <div key={row.canal} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-5 py-3.5">
                <div className="text-[13.5px] text-text font-medium">{row.canal}</div>
                <div className="flex items-center gap-2.5">
                  {row.badge && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-primary-soft text-primary">
                      {row.badge}
                    </span>
                  )}
                  <span className="text-[13px] text-text-muted">{row.sla}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Company identification */}
      <section id="empresa" style={{ scrollMarginTop: '72px' }} className="mb-10">
        <h2 className="text-[17px] md:text-[19px] font-semibold text-text mb-4">Identificação da Empresa</h2>
        <div className="rounded-2xl border border-border bg-surface px-5 py-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3 text-[13.5px]">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-widest font-semibold text-text-subtle">Razão Social</p>
              <p className="text-text"><Ph t="RAZÃO SOCIAL" /></p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-widest font-semibold text-text-subtle">CNPJ</p>
              <p className="text-text"><Ph t="CNPJ" /></p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-widest font-semibold text-text-subtle">Endereço</p>
              <p className="text-text-muted leading-[1.6]">
                <Ph t="LOGRADOURO, NÚMERO, BAIRRO" /><br />
                <Ph t="CIDADE" />/<Ph t="UF" /> — CEP <Ph t="CEP" />
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-widest font-semibold text-text-subtle">Nome Comercial</p>
              <p className="text-text font-semibold">Umbra Bot</p>
            </div>
          </div>
          <div className="pt-2 border-t border-border text-[12.5px] text-text-muted">
            As informações acima são exigidas pelo art. 10 do Decreto n.º 7.962/2013 (regulamentação do
            Código de Defesa do Consumidor para e-commerce).
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section id="links" style={{ scrollMarginTop: '72px' }} className="mb-10">
        <h2 className="text-[17px] md:text-[19px] font-semibold text-text mb-4">Links Úteis</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            {
              href: '/termos',
              title: 'Termos de Uso',
              desc: 'Regras de uso da Plataforma, responsabilidades e obrigações.',
            },
            {
              href: '/privacidade',
              title: 'Política de Privacidade',
              desc: 'Como coletamos, usamos e protegemos seus dados pessoais (LGPD).',
            },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-2xl border border-border bg-surface p-4 flex flex-col gap-1 hover:border-primary/40 hover:bg-primary-soft/10 transition-colors group"
            >
              <span className="text-[14px] font-semibold text-text group-hover:text-primary transition-colors">
                {link.title} →
              </span>
              <span className="text-[12.5px] text-text-muted leading-[1.6]">{link.desc}</span>
            </Link>
          ))}
        </div>
      </section>
    </LegalLayout>
  )
}
