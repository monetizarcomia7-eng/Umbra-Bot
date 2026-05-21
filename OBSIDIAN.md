# Segundo Cérebro — Obsidian

O conhecimento deste projeto é documentado e organizado no vault Obsidian em:

```
C:\Users\Usuario\OneDrive\Documentos\Obsidian Vault\umbra-bot\
```

## Estrutura do Vault

| Nota | Conteúdo |
|---|---|
| `00 - Início.md` | Mapa do conhecimento (MOC) — ponto de entrada |
| `01 - Regras e Convenções.md` | Regras absolutas, convenções de código |
| `02 - Stack e Arquitetura.md` | Tecnologias, DashboardProvider, pastas, crons |
| `03 - Estado do Projeto.md` | Checklist completo: pronto / mock / pendente |
| `04 - Banco de Dados e Migrações.md` | 62 migrações, schema, RLS, RPCs, triggers |
| `05 - Segurança.md` | AES-256-GCM, CSP, IDOR, RLS, rate limit, admin client |
| `06 - Variáveis de Ambiente.md` | Todas as envs documentadas (incl. SUPABASE_SERVICE_ROLE_KEY) |
| `Módulo - Dashboard e KPIs.md` | KPIs, deltas, gráfico |
| `Módulo - Financeiro.md` | Transactions, withdrawals, invoices, bank_accounts |
| `Módulo - Analytics.md` | Funil, coorte, UTM, filtros SQL |
| `Módulo - Atividade.md` | activity_events, Realtime, TTL, backfill |
| `Módulo - Alertas.md` | Alertas reais, TTL 30d, resolved_by_id, source |
| `Módulo - Notificações.md` | notification_prefs, upsert, canais |
| `Módulo - Clientes.md` | Contacts, Realtime, sort, timeline, CSV |
| `Módulo - Afiliados.md` | CRUD, /r/[slug], comissão, cookie de atribuição |
| `Módulo - Bots.md` | SSR + BotsClient + 9 server actions + webhook (motor de fluxo) + cron + perfil no Telegram |
| `Módulo - Fluxos.md` | SSR + FlowsClient, editor visual, templates, duplicar, handles dinâmicos, prévia com ramificações |
| `Módulo - Redirecionadores.md` | SSR + RedirectsClient, CRUD real, analytics lazy, seletor período 7/14/30d, sparkline preload, cloaking, redirect_click_events, RPCs (migração 065 + 066) |
| `Módulo - Remarketing.md` | SSR + RemarketingClient, CRUD real, Realtime, auto-save 30s, CSV export, ExecutionHistoryCard, paginação 50, lazy-load step_stats, 6 eventos PostHog, migrações 067 + 068 + 069, cron process-remarketing via cron-job.org |
| `Módulo - Disparador.md` | SSR + BroadcastsClient: CRUD real (criar/salvar/cancelar/deletar/duplicar), Realtime stale-draft guard, BestPracticesModal (6 dicas), MessageComposer (mídia URL + 3 botões inline), Filtros avançados (registered_after/before), KPI cards (Disparos no mês / Mensagens / Taxa / Em andamento), SendingStatusCard, PreviewBroadcast, AudiencePicker por bot via RPC, cron process-broadcasts (15 min), register-webhooks utilitário, migração 070 |
| `Módulo - Gateways.md` | SSR + GatewaysClient: CRUD real (conectar/desconectar/reconectar/configurar/renovar token), OAuth 2.0 Mercado Pago (authorization_code, CSRF via state cookie, encryptToken), ConnectModal (modo oauth/manual, link externo dinâmico por provider), gateways_stats RPC (avgFeePct real das transações), Realtime canal gateways-realtime, ExpiryBadge (dias até expiração), RenewModal (renovar OAuth sem desconectar), taxa média ponderada por volume, 4 eventos PostHog (gateway_connected agora inclui OAuth / disconnected / configured / connection_tested), server action gateways.ts, OAuth routes, migração 074 (UNIQUE user_id+provider + RPC), migração 075 (token_expires_at) |
| `Módulo - Trackeamento.md` | SSR + TrackingClient: PIXEL_CATALOG (Meta/TikTok/Google), 3 PixelCards sempre visíveis (sem NoDataState), EditPixelModal (validação de formato inline, pixelCode TikTok separado), VerifyPixelModal (aba Verificar + aba Payload Preview, sendTestPixelEvent atualiza last_test_at), auto-open VerifyPixelModal após save novo (pendingVerifyRef), histórico last_test_at no card, status 5 estados + dbStatus (inactive/waiting/healthy/warning/error), Export JSON, Realtime dual-channel, auto-refresh 5 min, match rate tip, SnippetCard (snippets HTML browser-side por provider), CAPI automático via lib/capi.ts (fire-and-forget no webhook MP), testPixelAction persiste status='healthy' no banco, 4 eventos PostHog, migração 076 (UUID PK + UNIQUE + RLS + RPC pixels_stats), migração 077 (pixel_code + last_test_at) |
| `Módulo - Checkout.md` | SSR + CheckoutClient (dados reais, migrações 078–082): CRUD real (criar/salvar/publicar/duplicar/arquivar/reativar/apagar), botão Copiar link no menu do card, PreviewPanel com toggle Desktop/Mobile (phone frame 375 px), seção "Configurações avançadas" (success_url/guarantee_days/countdown_end), validação de protocolo em success_url (http/https), upload product_image (Supabase Storage + cleanup ao substituir/apagar), analytics drill-down por checkout (funil visited/cart/paid lazy), templates modal (3 templates), auto-save 30s, BackConfirm, Realtime canal 'checkouts-realtime'; Página pública /c/[slug]: CPF/CNPJ mask automática + validação de algoritmo mod-11, countdown PIX 30 min, polling checkout_tx_status (RPC, 4s), success_url redirect, guarantee badge, countdown_end timer de urgência (suporta dias: "1d 02:30:15"); API /api/checkout/pay: taxa PIX corrigida 0,99%, validação algoritmo CPF/CNPJ, persiste checkout_id + customer_phone; 4 eventos PostHog; migrações 078–082; migração 082: RLS checkouts_owner (IDOR crítico resolvido) |
| `Módulo - Documentação.md` | /docs/ 30 artigos, /dashboard/docs renderizador, marked, toggle tema |
| `Referência - Eventos PostHog.md` | 47 eventos rastreados (inclui campaign_created/saved/activated/paused/deleted + csv_exported remarketing + gateway_disconnected/configured/connection_tested + redirect_archived) |
| `Referência - Onboarding Wizard.md` | 4 passos, localStorage, gateway |
| `Referência - Busca Global.md` | 14 tabelas, race condition, debounce |
| `Referência - Cron Jobs.md` | 4 crons no vercel.json (Hobby executa só 2) + process-remarketing via cron-job.org (1x/hora) + process-broadcasts via cron-job.org (15 min) + register-webhooks (utilitário admin, CRON_SECRET) |

## Notas a criar/atualizar no Vault após esta sessão

| Nota | O que atualizar |
|---|---|
| `Módulo - Trackeamento.md` | **Atualizar** — adicionar melhorias desta sessão: 3 cards sempre visíveis, EditPixelModal com validação inline (FORMAT_REGEX por provider), campo pixelCode TikTok (migração 077), status 'waiting' separado de 'warning', dbStatus no PixelItem (computeStatus retorna 'healthy' quando dbStatus='healthy' mesmo sem eventos), testPixelAction persiste status='healthy'/'warning' no banco (fire-and-forget), auto-open VerifyPixelModal após save novo (pendingVerifyRef + useEffect[editing]), aba "Payload Preview" no VerifyPixelModal (buildSamplePayload), histórico last_test_at no card, Export JSON (sem token), savePixelAction retorna { id }, sendTestPixelEvent atualiza last_test_at (migração 077), SnippetCard (snippets HTML copy-paste por provider: Meta fbevents.js / TikTok ttq.load() / Google gtag.js), CAPI automático: lib/capi.ts (fireCapiPurchase: Meta/TikTok/Google em Promise.allSettled, SHA-256 email+nome, event_id=txId para dedup, createAdminClient), webhook MP dispara CAPI fire-and-forget ao aprovar pagamento |
| `Módulo - Gateways.md` | **Criar** — documentar módulo completo conforme Seção 24 do CLAUDE.md: GatewaysClient (ConnectModal oauth/manual, DisconnectModal, ConfigModal, TestModal, RenewModal, ExpiryBadge, Realtime canal gateways-realtime, applyRealtimeRow preservando stats RPC, avgFeePct real da RPC, taxa média ponderada por volume, link externo dinâmico por provider, toast com X manual, GatewayCard stats grid 3-col), OAuth MP (authorization_code, CSRF state cookie, encryptToken, callback, upsert onConflict user_id+provider, token_expires_at = now()+180d), server action gateways.ts (disconnectGatewayAction limpa token_expires_at), rotas /api/payments/mercadopago-oauth + callback, migração 074 (RLS owner + UNIQUE + account_id FK + RPC gateways_stats), migração 075 (token_expires_at), 4 eventos PostHog (gateway_connected agora inclui OAuth via mpConnected useEffect) |
| `Módulo - Disparador.md` | **Criar** — documentar módulo completo conforme Seção 23 do CLAUDE.md: BroadcastList (KPI 4 cards, filtros, tabela, duplicar), BroadcastEditor (MessageComposer mídia/botões, SchedulePicker, Filtros avançados, SendingStatusCard, PreviewBroadcast, SummaryCard), Realtime stale-draft guard, BestPracticesModal, AudiencePicker localCounts por bot, /api/broadcasts/send, cron process-broadcasts (15 min), register-webhooks, migração 070, tipos internos |
| `Módulo - Remarketing.md` | **Criar** — documentar módulo completo: SSR (page.tsx limit 50, sem step_stats, initialHasMore), RemarketingClient (CRUD real, Realtime, Templates 4, auto-save 30s, CSV export BOM, paginação .range(), openCampaign lazy-load step_stats, ExecutionHistoryCard, aviso dirty, 6 PostHog events), cron process-remarketing (7 gatilhos, multi-step scheduling, increment_campaign_sent RPC, cron-job.org 1x/hora), migrações 067 + 068 + 069 |
| `Módulo - Fluxos.md` | **Atualizar** — adicionar: motor de execução de fluxo no webhook (executeFlowNode recursivo, 9 tipos de nó), migração 064 (flow_id/flow_node_id/flow_vars em contacts), correção inspector (bgPannedRef), correção campo Question (data.text ?? data.question) |
| `Módulo - Bots.md` | **Atualizar** — 9 server actions (+ getBotTelegramProfileAction, saveBotTelegramProfileAction, setBotPhotoAction); TelegramProfileModal (foto base64, nome, descrição, short desc, comandos reordenáveis); welcome_message só para novos contatos (isNewContact); motor de fluxo no webhook; fix webhook upsert contacts (campo name + error check) |
| `Módulo - Redirecionadores.md` | **Atualizar** — melhorias: seletor de período 7/14/30d; sparkline preload 14d; loadAnalytics estável via refs; cache ${id}:${period}; confirmação inline ao pausar; slug sanitização defensiva; KPI "Cliques únicos (30d)" RPC 066; KPI "Top link" all-time; cloaking null-safe; status archived; migração 066 |
| `04 - Banco de Dados e Migrações.md` | Adicionar migrações 063–082: trigger_type+keywords (flows), flow_id/flow_node_id/flow_vars (contacts), redirects RLS + redirect_click_events + RPCs (065), redirect_unique_clicks_30d (066), remarketing bot_id+last_run_at+total_sent (067), remarketing next_run_at + remarketing_executions (068), remarketing cron índices + increment_campaign_sent RPC (069), broadcasts migração 070 (user_id NOT NULL + índice cron + RPC counts), contacts UNIQUE INDEX (072) → UNIQUE CONSTRAINT (073), gateways UNIQUE user_id+provider + account_id FK + RPC gateways_stats (074), gateways token_expires_at timestamptz (075), pixels schema correto UUID PK + RLS + RPC pixels_stats (076), pixels pixel_code + last_test_at (077), checkout_id + trigger sync_checkout_stats + RPC track_checkout_visit (078), checkout_id + customer_phone em transactions + RPC checkout_tx_status (079), product_image + bucket checkout-images (080), success_url + guarantee_days + countdown_end em checkouts (081), checkouts_owner RLS fix (082) |
| `Módulo - Checkout.md` | **Criar** — documentar módulo completo conforme Seção 26 do CLAUDE.md: editor (PreviewPanel Desktop/Mobile, seção Avançado com success_url/guarantee_days/countdown_end + validação de protocolo, upload product_image + cleanup ao substituir/apagar, analytics drill-down funil lazy, botão Reativar + Copiar link), página pública /c/[slug] (CPF/CNPJ mask + validação mod-11, countdown PIX, polling checkout_tx_status, success_url redirect, guarantee badge, countdown_end timer com dias), API /api/checkout/pay (taxa 0,99%, validação CPF/CNPJ mod-11, checkout_id + customer_phone), migrações 078–082, interfaces TypeScript, segurança |
| `03 - Estado do Projeto.md` | Marcar Disparador ✅ Funcional; Remarketing ✅ Funcional; Redirecionadores ✅; Fluxos/webhook/perfil-Telegram ✅; Gateways ✅ Funcional (OAuth MP real); Trackeamento ✅ Funcional (pixels reais + CAPI); Checkout ✅ Funcional (melhorias desta sessão: RLS IDOR resolvido, taxa PIX corrigida, validação CPF/CNPJ mod-11, limpeza de imagens órfãs, botão Reativar, botão Copiar link, validação success_url, fmtCountdown com dias, migrações 078–082) |
| `Módulo - Afiliados.md` | **Atualizar** — /r/[slug] prioridade dupla: afiliado primeiro, depois redirecionador |
| `Referência - Eventos PostHog.md` | **Atualizar** — total ~51 eventos: +5 campaign + csv_exported remarketing + gateway_disconnected/configured/connection_tested + pixel_configured/pixel_verified/pixel_test_sent/utm_link_copied |

## Como Atualizar

Sempre que uma feature nova for implementada ou uma migração for criada:
1. Atualizar o `CLAUDE.md` (fonte da verdade para Claude Code)
2. Atualizar a nota correspondente no Obsidian
3. Atualizar o checklist em `03 - Estado do Projeto.md`
4. Se nova migração: adicionar em `04 - Banco de Dados e Migrações.md`

## Fonte da Verdade

O arquivo `CLAUDE.md` neste repositório é a fonte de verdade para sessões de desenvolvimento com o Claude Code. O vault Obsidian é um espelho organizado para navegação humana.
