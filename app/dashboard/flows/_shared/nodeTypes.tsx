import React from 'react'
import {
  MessageSquare, HelpCircle, MousePointerClick, Split, Clock,
  ShoppingBag, Tag, UserRound,
  Image as LucideImage, Link2, ShoppingCart, Phone,
  TrendingUp, TrendingDown, PackagePlus, Megaphone, Video,
} from 'lucide-react'
import type { NodeData } from './types'

export const NODE_W = 220
export const NODE_H = 96
export const GRID_SIZE = 20

export interface NodeTypeDef {
  label: string
  Icon: React.ElementType
  color: string
  category: string
  description: string
  defaultData: NodeData
  outputs: number
}

export const nodeTypes: Record<string, NodeTypeDef> = {
  message:     { label: 'Mensagem',    Icon: MessageSquare,     color: 'var(--primary)',         category: 'Conversa',   description: 'Envia uma mensagem de texto ao usuário.',                                                            defaultData: { text: 'Sua mensagem aqui…' },                                                                                                                                    outputs: 1 },
  question:    { label: 'Pergunta',    Icon: HelpCircle,        color: 'var(--primary)',         category: 'Conversa',   description: 'Faz uma pergunta e captura a resposta numa variável.',                                               defaultData: { question: 'Qual seu nome?', variable: 'nome' },                                                                                                                   outputs: 1 },
  buttons:     { label: 'Botões',      Icon: MousePointerClick, color: 'var(--primary)',         category: 'Conversa',   description: 'Mostra botões de escolha rápida. Cada botão é uma saída.',                                           defaultData: { text: 'Escolha uma opção:', options: ['Opção A', 'Opção B'] },                                                                                                     outputs: -1 },
  condition:   { label: 'Condição',    Icon: Split,             color: 'var(--warning)',         category: 'Lógica',     description: 'Bifurca o fluxo conforme uma variável (se/senão).',                                                  defaultData: { variable: 'nome', operator: 'igual', value: '' },                                                                                                                 outputs: 2 },
  delay:       { label: 'Espera',      Icon: Clock,             color: 'oklch(0.58 0.05 280)',   category: 'Lógica',     description: 'Pausa o fluxo por um tempo definido.',                                                               defaultData: { amount: 1, unit: 'horas' },                                                                                                                                       outputs: 1 },
  offer:       { label: 'Oferta',      Icon: ShoppingBag,       color: 'var(--success)',         category: 'Comercial',  description: 'Apresenta um produto com botão de compra.',                                                          defaultData: { product: 'Mentoria Premium', price: 1297, cta: 'Comprar agora' },                                                                                                  outputs: 1 },
  tag:         { label: 'Aplicar tag', Icon: Tag,               color: 'oklch(0.60 0.13 200)',   category: 'CRM',        description: 'Adiciona ou remove uma tag do contato.',                                                             defaultData: { action: 'add', tag: 'VIP' },                                                                                                                                      outputs: 1 },
  handoff:     { label: 'Humano',      Icon: UserRound,         color: 'var(--danger)',          category: 'CRM',        description: 'Encaminha o atendimento para o time humano.',                                                        defaultData: { team: 'Suporte', message: 'Um humano vai te atender em instantes.' },                                                                                              outputs: 0 },
  image:       { label: 'Imagem',      Icon: LucideImage,       color: 'oklch(0.55 0.12 280)',   category: 'Mídia',      description: 'Envia uma imagem com legenda opcional.',                                                             defaultData: { imageUrl: '', caption: '' },                                                                                                                                      outputs: 1 },
  video:       { label: 'Vídeo',       Icon: Video,             color: 'oklch(0.52 0.18 20)',    category: 'Mídia',      description: 'Envia um vídeo (MP4) com legenda opcional.',                                                         defaultData: { videoUrl: '', caption: '' },                                                                                                                                      outputs: 1 },
  link:        { label: 'Link/Botão',  Icon: Link2,             color: 'oklch(0.52 0.18 250)',   category: 'Mídia',      description: 'Envia um botão inline com URL (Telegram InlineKeyboard).',                                           defaultData: { text: 'Clique aqui!', url: '' },                                                                                                                                  outputs: 1 },
  checkout:    { label: 'Checkout',    Icon: ShoppingCart,      color: 'var(--success)',         category: 'Comercial',  description: 'Envia link de pagamento como botão inline. Avança automaticamente.',                                  defaultData: { text: 'Clique para comprar:', url: '' },                                                                                                                          outputs: 1 },
  phone:       { label: 'Telefone',    Icon: Phone,             color: 'oklch(0.58 0.12 200)',   category: 'Conversa',   description: 'Pede o número de telefone e salva na variável do contato.',                                          defaultData: { text: 'Qual é o seu telefone? (ex: 11999998888)', variable: 'telefone' },                                                                                          outputs: 1 },
  upsell:      { label: 'Upsell',      Icon: TrendingUp,        color: 'oklch(0.55 0.19 145)',   category: 'Comercial',  description: 'Oferece um produto de maior valor após a compra inicial.',                                           defaultData: { product: 'Produto Premium', originalPrice: 997, discountPrice: 697, description: 'Aproveite essa oferta exclusiva por tempo limitado!', cta: 'Quero o upgrade', url: '' }, outputs: 1 },
  downsell:    { label: 'Downsell',    Icon: TrendingDown,      color: 'oklch(0.58 0.16 30)',    category: 'Comercial',  description: 'Oferece uma alternativa mais acessível quando o lead recusa a oferta principal.',                    defaultData: { product: 'Produto Básico', originalPrice: 497, discountPrice: 197, description: 'Tudo bem! Tenho uma opção mais em conta para você.', cta: 'Quero essa opção', url: '' }, outputs: 1 },
  orderbump:   { label: 'Order Bump',  Icon: PackagePlus,       color: 'oklch(0.58 0.16 200)',   category: 'Comercial',  description: 'Adiciona um produto complementar com desconto na mesma compra.',                                     defaultData: { product: 'Bônus Especial', price: 97, description: 'Inclua também por apenas:', cta: 'Sim, quero o bônus!' },                                                     outputs: 1 },
  remarketing: { label: 'Remarketing', Icon: Megaphone,         color: 'oklch(0.52 0.18 285)',   category: 'CRM',        description: 'Agenda uma mensagem de follow-up para contatos que não converteram.',                                defaultData: { text: 'Oi {nome}! Vi que você ainda não finalizou. Posso te ajudar? 😊', delayAmount: 1, delayUnit: 'horas', tag: '' },                                            outputs: 1 },
}

export const flowStatusMap: Record<string, { label: string; tone: string }> = {
  published: { label: 'Publicado', tone: 'success' },
  draft:     { label: 'Rascunho',  tone: 'muted'   },
}
