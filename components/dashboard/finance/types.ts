export interface TxDetail {
  customer: string; email: string; product: string; gateway: string; method: string
  gross: number; gatewayFee: number; platformFee: number; net: number; bot: string; flow: string
  utmSource?: string; utmCampaign?: string
  phone?: string; device?: string; checkoutId?: string
}

export interface Transaction {
  id: string; dt: string
  type: 'sale' | 'fee' | 'commission' | 'refund' | 'withdraw'
  desc: string; value: number
  status: 'available' | 'pending' | 'completed' | 'failed' | 'expired' | 'cancelled'
  detail?: TxDetail
  botId?: string | null
  gatewayRaw?: string | null
}

export interface Withdrawal {
  id: string; date: string; amount: number; account: string
  status: 'completed' | 'pending' | 'failed'; concluded: string
  notes: string | null
}

export interface Invoice {
  id: string; period: string; value: number; due: string
  status: 'paid' | 'pending' | 'overdue'
}

export interface BankAccount {
  id: string
  label: string
  pix_key: string
  kind: 'pix' | 'conta' | 'ted'
  created_at: string
}

export interface FinanceSummary {
  saldoDisponivel: number; aLiberar: number; totalRecebido: number
  comissoesPlataforma: number; deltas: Record<string, number>
}

export interface FinanceData {
  summary: FinanceSummary
  transactions: Transaction[]
  withdrawals: Withdrawal[]
  invoices: Invoice[]
}

// ── Raw types vindos do Supabase ─────────────────────────────

export interface RawTransaction {
  id: string
  amount: number
  net: number | null
  fee: number | null
  status: string
  type: string | null
  payment_method: string | null
  product_name: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_device: string | null
  checkout_id: string | null
  gateway: string | null
  bot_id: string | null
  flow_id: string | null
  utm_source: string | null
  utm_campaign: string | null
  created_at: string
}

export interface RawWithdrawal {
  id: string; amount: number; account_id: string; account_label: string
  status: 'pending' | 'completed' | 'failed'
  created_at: string; concluded_at: string | null
  notes: string | null
}

export interface RawFinanceBot {
  id: string
  name: string
  username: string | null
}

export interface RawFinanceFlow {
  id: string
  name: string
}

export interface RawInvoice {
  id: string
  period: string
  value: number
  due_date: string
  status: 'paid' | 'pending' | 'overdue'
  created_at: string
}

export interface RawFinanceSummary {
  saldo_disponivel:     number
  a_liberar:            number
  total_recebido:       number
  comissoes_plataforma: number
}
