const TZ = 'America/Sao_Paulo'

export const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

export const fmtBRLdec = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

export const fmtPct = (v: number, d = 1) => `${v.toFixed(d)}%`

export const fmtDate = (dt: string) =>
  new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ })

export const fmtDateTime = (dt: string) =>
  new Date(dt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ })

export const fmtDateShort = (dt: string) =>
  new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ })

export const fmtTime = (dt: string) =>
  new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
