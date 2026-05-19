'use client'

import React from 'react'
import { Download, FileText } from 'lucide-react'
import type { Invoice } from './types'
import { invStatusMap } from './constants'
import { fmtDate, fmtBRLdec } from './formatters'
import { Badge, Card, Btn } from './atoms'

export function InvoicesSection({ data }: { data: Invoice[] }) {
  const totalOpen = data.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.value, 0)
  const openCount = data.filter((i) => i.status !== 'paid').length

  if (data.length === 0) {
    return (
      <Card
        title="Faturas da plataforma"
        subtitle="Assinatura + variável por uso"
        noPadding
      >
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-text-muted border-t border-border">
          <FileText size={32} className="opacity-30" />
          <p className="text-[13px]">Nenhuma fatura gerada ainda.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card
      title="Faturas da plataforma"
      subtitle={`Assinatura + variável por uso · ${openCount} em aberto`}
      action={totalOpen > 0 ? (
        <div className="text-right">
          <div className="text-[10.5px] text-text-muted uppercase tracking-wider font-medium">Em aberto</div>
          <div className="text-[16px] font-semibold tnum text-warning leading-none mt-0.5">{fmtBRLdec(totalOpen)}</div>
        </div>
      ) : undefined}
      noPadding
    >
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full text-[12.5px] border-collapse min-w-[640px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wider text-text-subtle font-semibold">
              <th className="text-left  font-semibold pl-4 pr-2 py-2.5">Período</th>
              <th className="text-left  font-semibold px-2 py-2.5">Vencimento</th>
              <th className="text-right font-semibold px-2 py-2.5">Valor</th>
              <th className="text-left  font-semibold px-2 py-2.5">Status</th>
              <th className="text-right pl-2 pr-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((inv) => {
              const st = invStatusMap[inv.status]
              return (
                <tr key={inv.id} className="border-t border-border hover:bg-surface-2/40">
                  <td className="py-2.5 pl-4 pr-2 text-text">{inv.period}</td>
                  <td className="py-2.5 px-2 text-text-muted tnum">{fmtDate(inv.due)}</td>
                  <td className="py-2.5 px-2 text-right tnum font-semibold text-text">{fmtBRLdec(inv.value)}</td>
                  <td className="py-2.5 px-2"><Badge tone={st.tone}>{st.label}</Badge></td>
                  <td className="py-2.5 pl-2 pr-4 text-right">
                    <div className="inline-flex items-center gap-0.5">
                      {inv.status !== 'paid' && (
                        <Btn variant="ghost" size="sm" iconName="credit-card">Pagar</Btn>
                      )}
                      <button className="h-8 w-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text" title="Baixar PDF">
                        <Download size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
