'use client'

import React from 'react'
import Link from 'next/link'
import { Search, ArrowRight, BookOpen } from 'lucide-react'
import { DocsLayout } from '@/components/docs/DocsLayout'
import { DOCS_CATEGORIES, toMeta } from '@/lib/docs/content'

const META = toMeta(DOCS_CATEGORIES)

const FEATURED = [
  { title: 'Conectar seu primeiro bot',   href: '/docs/bots/conectar-bot',           desc: 'Token do BotFather → painel em menos de 2 minutos.' },
  { title: 'Visão geral do painel',       href: '/docs/primeiros-passos/visao-geral', desc: 'Métricas, gráfico de receita e pedidos recentes.' },
  { title: 'Criar fluxo de venda',        href: '/docs/fluxos/editor-de-fluxos',      desc: 'Blocos visuais para montar funis automatizados.' },
  { title: 'Configurar um gateway',       href: '/docs/pagamentos/conectar-gateway',  desc: 'Aceite PIX e configure split de comissão.' },
  { title: 'Criar campanha de remarketing', href: '/docs/remarketing/campanhas',      desc: 'Recupere PIX abandonados e leads inativos.' },
  { title: 'Disparador em massa',         href: '/docs/disparador/envios',            desc: 'Envie mensagens para segmentos da sua base.' },
]

export default function DocsHomePage() {
  return (
    <DocsLayout categories={META}>
      {/* Hero */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-primary-soft text-primary text-[10.5px] font-bold uppercase tracking-widest mb-4">
          <BookOpen size={11} /> Documentação
        </div>
        <h1 className="text-[28px] md:text-[34px] font-semibold text-text leading-tight mb-2">
          Central de Ajuda
        </h1>
        <p className="text-[15px] text-text-muted max-w-xl leading-relaxed">
          Tudo que você precisa para configurar e operar o Umbra Bot — desde conectar o primeiro
          bot até montar funis de venda e analisar resultados.
        </p>

        {/* Search (visual only — integração futura) */}
        <div className="relative mt-5 max-w-lg">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
          <input
            placeholder="Buscar na documentação… (use a barra lateral)"
            className="w-full pl-10 pr-4 py-3 text-[13.5px] bg-surface border border-border rounded-xl text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            readOnly
            onClick={() => {}}
          />
        </div>
      </div>

      {/* Featured */}
      <div className="mb-10">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-text-subtle mb-4">
          Artigos em destaque
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURED.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-xl border border-border bg-surface p-4 hover:border-primary/40 hover:bg-primary-soft/10 transition-colors flex flex-col gap-1.5"
            >
              <span className="text-[13.5px] font-semibold text-text group-hover:text-primary transition-colors flex items-center gap-1.5">
                {item.title}
                <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
              <span className="text-[12.5px] text-text-muted leading-[1.6]">{item.desc}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* All categories */}
      <div>
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-text-subtle mb-4">
          Todas as categorias
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {DOCS_CATEGORIES.map((cat) => (
            <div key={cat.slug} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[20px]">{cat.icon}</span>
                <h3 className="text-[14px] font-semibold text-text">{cat.title}</h3>
              </div>
              <p className="text-[12.5px] text-text-muted mb-3 leading-[1.6]">{cat.description}</p>
              <div className="space-y-0.5">
                {cat.articles.map((art) => (
                  <Link
                    key={art.slug}
                    href={`/docs/${cat.slug}/${art.slug}`}
                    className="flex items-center gap-2 text-[12.5px] text-primary hover:underline py-0.5"
                  >
                    <ArrowRight size={11} className="shrink-0" />
                    {art.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DocsLayout>
  )
}
