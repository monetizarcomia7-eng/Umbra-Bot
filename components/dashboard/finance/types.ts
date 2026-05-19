export interface TxDetail {
  customer: string; email: string; product: string; gateway: string; method: string
  gross: number; gatewayFee: number; platformFee: number; net: number; bot: string; flow: string
}

export interface Transaction {
  id: string; dt: string
  type: 'sale' | 'fee' | 'commission' | 'refund' | 'withdraw'
  desc: string; value: number
  status: 'available' | 'pending' | 'completed' | 'failed'
  detail?: TxDetail
}

export interface Withdrawal {
  id: string; date: string; amount: number; account: string
  status: 'completed' | 'pending' | 'failed'; concluded: string
}

export interface Invoice {
  id: string; period: string; value: number; due: string
  status: 'paid' | 'pending' | 'overdue'
}

export interface Conta { id: string; label: string; bank: string; kind: string }

export interface FinanceSummary {
  saldoDisponivel: number; aLiberar: number; totalRecebido: number
  comissoesPlataforma: number; deltas: Record<string, number>
}

export interface FinanceData {
  summary: FinanceSummary
  contas: Conta[]
  transactions: Transaction[]
  withdrawals: Withdrawal[]
  invoices: Invoice[]
}

export interface RawTransaction {
  id: string; amount: number; net: number | null; fee: number | null
  status: string; product_name: string | null; customer_name: string | null
  gateway: string | null; created_at: string
}
