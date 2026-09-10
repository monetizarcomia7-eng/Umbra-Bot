'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Package, Plus, Search, Users, Handshake, CreditCard, MoreHorizontal } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/PageHeader'

type Product = { id:string; name:string; price:number; status:string; payment_type:string; updated_at:string }
type Partnership = { id:string; created_at:string; partner_email:string; role:string; commission_pct:number; expires_at:string|null; status:string; producer_id:string; partner_id:string|null; products:{name:string}|null }
type Subscription = { id:string; started_at:string; customer_name:string; customer_email:string; status:string; net_amount:number; products:{name:string}|null }
type MainTab = 'myproducts'|'coproductions'|'affiliations'|'subscriptions'

const money = (v:number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v)
const date = (v:string|null) => v ? new Intl.DateTimeFormat('pt-BR').format(new Date(v)) : '—'
const statusLabel:Record<string,string> = {draft:'Rascunho',active:'Ativo',archived:'Arquivado',pending:'Pendente',rejected:'Recusado',canceled:'Cancelada',expired:'Expirada',trial:'Teste',unpaid:'Inadimplente',waiting_payment:'Aguardando pagamento',ended:'Encerrada'}

export default function ProductsClient({userId,initialProducts,partnerships,subscriptions}:{userId:string;initialProducts:Product[];partnerships:Partnership[];subscriptions:Subscription[]}) {
  const router=useRouter(), params=useSearchParams()
  const initial=(params.get('tab') as MainTab)||'myproducts'
  const [tab,setTab]=useState<MainTab>(['myproducts','coproductions','affiliations','subscriptions'].includes(initial)?initial:'myproducts')
  const [subTab,setSubTab]=useState<'active'|'canceled'|'all'>('active')
  const [search,setSearch]=useState('')
  const setActive=(next:MainTab)=>{setTab(next);router.replace(`/dashboard/products?tab=${next}`)}
  const ownPartnerships=partnerships.filter(p=>p.role==='coproducer'&&(p.partner_id===userId||p.producer_id===userId))
  const affiliations=partnerships.filter(p=>p.role==='affiliate'&&p.partner_id===userId)
  const filteredSubs=useMemo(()=>subscriptions.filter(s=>subTab==='all'||(subTab==='active'?['active','trial','unpaid','waiting_payment'].includes(s.status):['canceled','ended'].includes(s.status))),[subscriptions,subTab])
  const th='px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-subtle'
  const td='px-5 py-4 text-sm text-text-muted'
  return <div className="space-y-6">
    <PageHeader title="Produtos" subtitle="Gerencie produtos, parcerias, afiliações e assinaturas." actions={<Link href="/dashboard/products/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg"><Plus size={17}/>Criar produto</Link>}/>
    <div className="flex gap-1 overflow-x-auto border-b border-border">
      {([['myproducts','Meus produtos',Package],['coproductions','Minhas co-produções',Handshake],['affiliations','Minhas afiliações',Users],['subscriptions','Assinaturas',CreditCard]] as const).map(([id,label,Icon])=><button key={id} onClick={()=>setActive(id)} className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium ${tab===id?'border-primary text-primary':'border-transparent text-text-muted hover:text-text'}`}><Icon size={16}/>{label}</button>)}
    </div>
    {tab==='myproducts'&&<section className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border"><div className="relative max-w-sm flex-1"><Search size={16} className="absolute left-3 top-2.5 text-text-subtle"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar produto" className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"/></div><span className="text-xs text-text-subtle">{initialProducts.length} produto(s)</span></div>
      <table className="w-full"><thead className="bg-surface-2"><tr><th className={th}>Nome</th><th className={th}>Preço</th><th className={th}>Tipo</th><th className={th}>Status</th><th/></tr></thead><tbody className="divide-y divide-border">{initialProducts.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())).map(p=><tr key={p.id} className="hover:bg-surface-2/60"><td className={`${td} font-medium text-text`}><Link href={`/dashboard/products/${p.id}`} className="hover:text-primary">{p.name}</Link></td><td className={td}>{money(Number(p.price))}</td><td className={td}>{p.payment_type==='recurring'?'Assinatura':'Pagamento único'}</td><td className={td}><Badge status={p.status}/></td><td className={td}><Link aria-label="Editar" href={`/dashboard/products/${p.id}`}><MoreHorizontal size={18}/></Link></td></tr>)}</tbody></table><Empty show={!initialProducts.length} text="Você ainda não criou nenhum produto."/>
    </section>}
    {tab==='coproductions'&&<PartnershipTable rows={ownPartnerships} kind="coproduction"/>}
    {tab==='affiliations'&&<PartnershipTable rows={affiliations} kind="affiliate"/>}
    {tab==='subscriptions'&&<section className="space-y-4"><div className="flex gap-2">{(['active','canceled','all'] as const).map(s=><button key={s} onClick={()=>setSubTab(s)} className={`rounded-lg px-4 py-2 text-sm ${subTab===s?'bg-primary text-primary-fg':'bg-surface-2 text-text-muted'}`}>{s==='active'?'Ativas':s==='canceled'?'Canceladas':'Todas'}</button>)}</div><div className="rounded-xl border border-border bg-surface overflow-hidden"><table className="w-full"><thead className="bg-surface-2"><tr>{['Data de início','Produto','Cliente','Status','Valor líquido'].map(x=><th key={x} className={th}>{x}</th>)}</tr></thead><tbody className="divide-y divide-border">{filteredSubs.map(s=><tr key={s.id}><td className={td}>{date(s.started_at)}</td><td className={`${td} text-text`}>{s.products?.name??'—'}</td><td className={td}><div>{s.customer_name}</div><div className="text-xs text-text-subtle">{s.customer_email}</div></td><td className={td}><Badge status={s.status}/></td><td className={td}>{money(Number(s.net_amount))}</td></tr>)}</tbody></table><Empty show={!filteredSubs.length} text="Nenhuma assinatura neste filtro."/></div></section>}
  </div>
}

function Badge({status}:{status:string}){return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${['active','trial'].includes(status)?'bg-success-soft text-success':status==='draft'||status==='pending'||status==='waiting_payment'?'bg-warning-soft text-warning':'bg-surface-2 text-text-muted'}`}>{statusLabel[status]??status}</span>}
function Empty({show,text}:{show:boolean;text:string}){return show?<div className="p-12 text-center text-sm text-text-muted"><Package className="mx-auto mb-3 text-text-subtle"/>{text}</div>:null}
function PartnershipTable({rows,kind}:{rows:Partnership[];kind:'coproduction'|'affiliate'}){const th='px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-subtle',td='px-5 py-4 text-sm text-text-muted';return <div className="rounded-xl border border-border bg-surface overflow-hidden"><table className="w-full"><thead className="bg-surface-2"><tr><th className={th}>Data</th><th className={th}>{kind==='affiliate'?'Nome':'Produto'}</th><th className={th}>Comissão</th>{kind==='coproduction'&&<th className={th}>Vencimento</th>}<th className={th}>Status</th></tr></thead><tbody className="divide-y divide-border">{rows.map(r=><tr key={r.id}><td className={td}>{date(r.created_at)}</td><td className={`${td} text-text`}>{r.products?.name??r.partner_email}</td><td className={td}>{Number(r.commission_pct).toLocaleString('pt-BR')}%</td>{kind==='coproduction'&&<td className={td}>{date(r.expires_at)}</td>}<td className={td}><Badge status={r.status}/></td></tr>)}</tbody></table><Empty show={!rows.length} text={kind==='affiliate'?'Você ainda não possui afiliações.':'Você ainda não possui co-produções.'}/></div>}
