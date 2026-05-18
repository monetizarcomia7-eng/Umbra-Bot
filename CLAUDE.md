# CLAUDE.md — Umbra Bot

Contexto automático para sessões de desenvolvimento. Atualizar sempre que o projeto evoluir.

---

## 1. ESTRUTURA

```
umbra-bot/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (ThemeProvider)
│   ├── page.tsx                  # Redirect para /dashboard
│   ├── globals.css               # Design tokens (light/dark), Tailwind v4
│   └── dashboard/
│       ├── page.tsx              # Overview (stats + gráfico + pedidos recentes)
│       ├── bots/page.tsx         # Lista de bots conectados
│       ├── finance/page.tsx      # Transações e saldo
│       └── activity/page.tsx     # Feed de eventos em tempo real
├── components/
│   ├── ThemeToggle.tsx           # Botão light/dark
│   └── dashboard/
│       ├── Layout.tsx            # Shell do dashboard (Sidebar + Topbar + motion)
│       ├── Sidebar.tsx           # Navegação colapsável (260px / 80px)
│       └── Topbar.tsx            # Busca global + notificações + ThemeToggle
├── hooks/
│   └── use-mobile.ts             # useIsMobile (breakpoint 768px)
├── lib/
│   └── utils.ts                  # cn() — clsx + tailwind-merge
├── .env.example                  # GEMINI_API_KEY, APP_URL
├── metadata.json                 # Nome, descrição, capabilities (Google AI Studio)
├── next.config.ts                # standalone output, transpilePackages motion
└── tsconfig.json                 # strict, path alias @/*
```

---

## 2. STACK

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 15.4.9 |
| UI | React | 19.2.1 |
| Linguagem | TypeScript (strict) | 5.9.3 |
| Estilo | Tailwind CSS v4 | 4.1.11 |
| Animações | Motion (Framer) | 12.23.24 |
| Gráficos | Recharts | 3.8.1 |
| Ícones | Lucide React | 0.553.0 |
| Tema | next-themes | 0.4.6 |
| AI (não usado) | @google/genai (Gemini) | 1.17.0 |
| Forms (não usado) | @hookform/resolvers | 5.2.1 |
| Deploy | Firebase (devDep, não configurado) | 15.0.0 |

**Origem do scaffold:** Google AI Studio — o README, `metadata.json` e lógica `DISABLE_HMR` no `next.config.ts` são artefatos do AI Studio. O projeto foi gerado lá e precisa ser desacoplado dessa plataforma para funcionar como SaaS independente.

---

## 3. ARQUITETURA ATUAL (estado real)

```
Browser
  └─► Next.js (App Router, standalone)
        ├── /dashboard           ← dados hardcoded (mock)
        ├── /dashboard/bots      ← dados hardcoded (mock)
        ├── /dashboard/finance   ← dados hardcoded (mock)
        └── /dashboard/activity  ← dados hardcoded (mock)

NÃO EXISTE:
  ✗ app/api/         (nenhuma rota de API)
  ✗ Backend          (sem servidor separado)
  ✗ Banco de dados   (sem Prisma/Drizzle/Postgres/Mongo)
  ✗ Autenticação     (sem sessão, sem JWT, sem OAuth)
  ✗ Telegram Bot     (sem webhook, sem grammy/telegraf)
  ✗ Pagamentos       (sem gateway integrado)
  ✗ Workers/Filas    (sem BullMQ/Redis)
  ✗ Multi-tenancy    (sem conceito de workspace/tenant)
```

**Arquitetura alvo** (a construir):

```
Browser
  └─► Next.js (frontend + API Routes)
        ├── app/api/             ← REST/tRPC endpoints
        ├── app/(auth)/          ← login, register, onboarding
        └── app/dashboard/       ← páginas do tenant

Next.js API Routes
  ├── Prisma ORM ─► PostgreSQL   ← dados multi-tenant
  ├── Redis / BullMQ             ← filas e cache
  └── Telegram Bot Server        ← webhook por bot

Telegram Bot Server (separado ou Route Handler)
  └── grammy / telegraf          ← recebe updates, processa funis

Gateways de Pagamento
  └── Mercado Pago / PagSeguro / Kirvano / Guru
```

---

## 4. MODELO DE DADOS

**Nenhuma entidade está modelada em banco.** Abaixo o modelo inferido a partir da UI:

| Entidade | Campos observados na UI | Status |
|---|---|---|
| **Tenant/User** | id, name, plan (Pro), initials | mock ("João Demo") |
| **Bot** | id, name, username, status, leads, sales, lastUpdate | mock |
| **Lead/Contact** | telegram_id, first_name, bot_id | implícito na UI |
| **Product** | id, name, price | implícito (atividade) |
| **Order/Transaction** | id, date, amount, fee, net, status, customer, code | mock |
| **Activity/Event** | id, type, title, description, amount, time | mock |
| **Flow** | (apenas link no sidebar, sem implementação) | — |

---

## 5. TELAS E API

### Telas implementadas (com mock)
| Rota | Componente | Conteúdo |
|---|---|---|
| `/` | `app/page.tsx` | Redirect para /dashboard |
| `/dashboard` | `app/dashboard/page.tsx` | Stats, gráfico de área, pedidos recentes |
| `/dashboard/bots` | `app/dashboard/bots/page.tsx` | Grid de bots, botões sem ação |
| `/dashboard/finance` | `app/dashboard/finance/page.tsx` | Saldo, saque, tabela de transações |
| `/dashboard/activity` | `app/dashboard/activity/page.tsx` | Feed de eventos com filtros |

### Rotas no sidebar sem página implementada (20 rotas)
`/dashboard/analytics`, `/dashboard/customers`, `/dashboard/affiliates`,
`/dashboard/alerts`, `/dashboard/flows`, `/dashboard/redirects`,
`/dashboard/remarketing`, `/dashboard/broadcasts`, `/dashboard/tools`,
`/dashboard/gateways`, `/dashboard/tracking`, `/dashboard/checkout`,
`/dashboard/biolink`, `/dashboard/webhooks`, `/dashboard/profile`,
`/dashboard/notifications`, `/dashboard/guide`, `/dashboard/academy`,
`/logout`

### API Routes
Nenhuma existe. Nenhum `app/api/` foi criado.

---

## 6. INTEGRAÇÕES

| Integração | Status |
|---|---|
| Telegram Bot API | Não iniciada — sem webhook, sem token |
| Gateway de pagamento | Não iniciada — apenas mock de transações |
| Pixel de rastreamento | Não iniciada |
| Webhooks externos | Não iniciada |
| Gemini AI (`@google/genai`) | Pacote instalado, não utilizado em nenhum arquivo |
| Firebase | `firebase-tools` como devDep, nenhuma config presente |

---

## 7. EXECUÇÃO LOCAL

```bash
npm install
# Criar .env.local com:
# GEMINI_API_KEY=sua_chave   (opcional enquanto não usar IA)
# APP_URL=http://localhost:3000

npm run dev   # http://localhost:3000
```

**Variáveis de ambiente necessárias hoje:**
- `GEMINI_API_KEY` — Gemini AI (não utilizado ainda)
- `APP_URL` — URL base da aplicação

**Serviços externos exigidos hoje:** nenhum (tudo é mock).

**Serviços que precisarão ser provisionados:**
- PostgreSQL (banco principal, multi-tenant)
- Redis (filas, cache de sessão)
- Telegram Bot Token(s) (BotFather)
- Gateway de pagamento (Mercado Pago, Kirvano, etc.)

---

## 8. CONVENÇÕES

- Todos os componentes são `'use client'` — nenhum Server Component implementado
- Path alias `@/*` → raiz do projeto
- Tailwind v4 com design tokens via CSS variables em `globals.css`
- Tema: `data-theme` attribute, gerenciado por `next-themes`
- Cores: paleta Zinc (shadcn/ui-like), sem biblioteca de componentes instalada
- `cn()` em `lib/utils.ts` para class merging
- Nenhum teste (unitário, integração ou e2e) existe
- ESLint configurado mas erros ignorados no build (`ignoreDuringBuilds: true`)
- TypeScript strict habilitado (`ignoreBuildErrors: false`)

---

## 9. ESTADO DO PROJETO

| Área | Estado |
|---|---|
| UI Shell (sidebar, topbar, layout, tema) | **Completo** |
| Dashboard overview (mock) | **Completo** |
| Tela de Bots (mock) | **Completo** |
| Tela Financeiro (mock) | **Completo** |
| Tela Atividade (mock) | **Completo** |
| Autenticação (login, registro, sessão) | **Não iniciado** |
| Multi-tenancy (workspaces, planos) | **Não iniciado** |
| Backend / API Routes | **Não iniciado** |
| Banco de dados (schema, migrations) | **Não iniciado** |
| Integração Telegram | **Não iniciado** |
| Gateways de pagamento | **Não iniciado** |
| Fluxos de automação | **Não iniciado** |
| Remarketing e disparos | **Não iniciado** |
| Funis de venda | **Não iniciado** |
| 20 páginas restantes do sidebar | **Não iniciado** |
| Testes | **Não iniciado** |
| Deploy / CI | **Não iniciado** |
