export const txTypeMap: Record<string, { label: string; icon: string; tone: string }> = {
  sale:       { label: 'Venda',    icon: 'shopping-bag',       tone: 'success'  },
  commission: { label: 'Comissão', icon: 'user-plus',          tone: 'warning'  },
  fee:        { label: 'Taxa',     icon: 'percent',            tone: 'muted'    },
  refund:     { label: 'Estorno',  icon: 'undo-2',             tone: 'danger'   },
  withdraw:   { label: 'Saque',    icon: 'arrow-up-from-line', tone: 'primary'  },
}

export const txStatusMap: Record<string, { label: string; tone: string }> = {
  available: { label: 'Disponível', tone: 'success' },
  pending:   { label: 'A liberar',  tone: 'warning' },
  completed: { label: 'Concluído',  tone: 'success' },
  failed:    { label: 'Falhou',     tone: 'danger'  },
  expired:   { label: 'Expirado',   tone: 'muted'   },
  cancelled: { label: 'Cancelado',  tone: 'danger'  },
}

export const wdStatusMap: Record<string, { label: string; tone: string }> = {
  completed: { label: 'Concluído',  tone: 'success' },
  pending:   { label: 'Em análise', tone: 'warning' },
  failed:    { label: 'Falhou',     tone: 'danger'  },
}

export const invStatusMap: Record<string, { label: string; tone: string }> = {
  paid:    { label: 'Paga',      tone: 'success' },
  pending: { label: 'Em aberto', tone: 'warning' },
  overdue: { label: 'Vencida',   tone: 'danger'  },
}

export const toneClasses: Record<string, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger:  'bg-danger-soft text-danger',
  primary: 'bg-primary-soft text-primary',
  muted:   'bg-surface-2 text-text-muted',
}

export const typeToFilter: Record<string, string> = {
  'Venda': 'sale', 'Comissão': 'commission', 'Taxa': 'fee', 'Estorno': 'refund', 'Saque': 'withdraw',
}

export const statusToFilter: Record<string, string> = {
  'Disponível': 'available',
  'A liberar':  'pending',
  'Concluído':  'completed',
  'Falhou':     'failed',
  'Expirado':   'expired',
  'Cancelado':  'cancelled',
}

export const filterPeriods = ['Últimos 7 dias', 'Últimos 30 dias', 'Últimos 90 dias', 'Este mês', 'Personalizado']
export const filterTypes   = ['Todos os tipos', 'Venda', 'Comissão', 'Taxa', 'Estorno', 'Saque']
export const filterStatus  = ['Todos os status', 'Disponível', 'A liberar', 'Concluído', 'Falhou', 'Expirado', 'Cancelado']

export const GATEWAY_LABEL: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  pushinpay:   'Pushinpay',
  pagarme:     'Pagar.me',
  stripe:      'Stripe',
}

export const DEVICE_LABEL: Record<string, string> = {
  mobile:  'Mobile',
  desktop: 'Desktop',
  tablet:  'Tablet',
  unknown: 'Desconhecido',
}
