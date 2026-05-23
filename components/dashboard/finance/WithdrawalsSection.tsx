'use client'

import React from 'react'
import { Inbox } from 'lucide-react'
import type { Withdrawal } from './types'
import { wdStatusMap } from './constants'
import { fmtDate, fmtDateTime, fmtBRLdec, fmtTime } from './formatters'
import { Badge, Card, Btn } from './atoms'

export function WithdrawalsSection({ data, onNew }: { data: Withdrawal[]; onNew: () => void }) {
  return (
    <Card
      title="Histórico de saques"
      subtitle="Saques solicitados no período selecionado"
      action={<Btn variant="secondary" size="sm" iconName="arrow-up-from-line" onClick={onNew}>Solicitar saque</Btn>}
      noPadding
    >
      {data.length === 0 ? (
        <div className="py-14 px-6 flex flex-col items-center justify-center text-center border-t border-border">
          <div className="w-11 h-11 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-3">
            <Inbox size={18} />
          </div>
          <div className="text-[13.5px] font-semibold text-text">Nenhum saque no período</div>
          <div className="text-[12px] text-text-muted mt-1 max-w-xs">Saques solicitados aparecerão aqui. Clique em "Solicitar saque" para iniciar uma retirada.</div>
        </div>
      ) : (
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full text-[12.5px] border-collapse min-w-[640px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wider text-text-subtle font-semibold">
              <th className="text-left  font-semibold pl-4 pr-2 py-2.5">Solicitado em</th>
              <th className="text-left  font-semibold px-2 py-2.5">Conta de destino</th>
              <th className="text-right font-semibold px-2 py-2.5">Valor</th>
              <th className="text-left  font-semibold px-2 py-2.5">Status</th>
              <th className="text-left  font-semibold pl-2 pr-4 py-2.5">Concluído</th>
            </tr>
          </thead>
          <tbody>
            {data.map((w) => {
              const st = wdStatusMap[w.status]
              return (
                <tr key={w.id} className="border-t border-border hover:bg-surface-2/40">
                  <td className="py-2.5 pl-4 pr-2 whitespace-nowrap">
                    <div className="text-[12.5px] text-text tnum">{fmtDate(w.date)}</div>
                    <div className="text-[10.5px] text-text-muted tnum">{fmtTime(w.date)}</div>
                  </td>
                  <td className="py-2.5 px-2 text-text">{w.account}</td>
                  <td className="py-2.5 px-2 text-right tnum font-semibold text-text">{fmtBRLdec(w.amount)}</td>
                  <td className="py-2.5 px-2">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {w.status === 'failed' && w.notes && (
                      <div className="text-[10.5px] text-danger mt-0.5 leading-tight max-w-[160px]">
                        {w.notes}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 pl-2 pr-4 text-text-muted tnum">
                    {w.status === 'completed' ? fmtDateTime(w.concluded) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
    </Card>
  )
}
