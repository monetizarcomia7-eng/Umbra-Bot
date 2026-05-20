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
| `Módulo - Documentação.md` | /docs/ 30 artigos, /dashboard/docs renderizador, marked, toggle tema |
| `Referência - Eventos PostHog.md` | 43 eventos rastreados (inclui campaign_created/saved/activated/paused/deleted + csv_exported remarketing) |
| `Referência - Onboarding Wizard.md` | 4 passos, localStorage, gateway |
| `Referência - Busca Global.md` | 14 tabelas, race condition, debounce |
| `Referência - Cron Jobs.md` | 4 crons no vercel.json (Hobby executa só 2) + process-remarketing via cron-job.org (1x/hora, CRON_SECRET) |

## Notas a criar/atualizar no Vault após esta sessão

| Nota | O que atualizar |
|---|---|
| `Módulo - Remarketing.md` | **Criar** — documentar módulo completo: SSR (page.tsx limit 50, sem step_stats, initialHasMore), RemarketingClient (CRUD real, Realtime, Templates 4, auto-save 30s, CSV export BOM, paginação .range(), openCampaign lazy-load step_stats, ExecutionHistoryCard, aviso dirty, 6 PostHog events), cron process-remarketing (7 gatilhos, multi-step scheduling, increment_campaign_sent RPC, cron-job.org 1x/hora), migrações 067 + 068 + 069 |
| `Módulo - Fluxos.md` | **Atualizar** — adicionar: motor de execução de fluxo no webhook (executeFlowNode recursivo, 9 tipos de nó), migração 064 (flow_id/flow_node_id/flow_vars em contacts), correção inspector (bgPannedRef), correção campo Question (data.text ?? data.question) |
| `Módulo - Bots.md` | **Atualizar** — 9 server actions (+ getBotTelegramProfileAction, saveBotTelegramProfileAction, setBotPhotoAction); TelegramProfileModal (foto base64, nome, descrição, short desc, comandos reordenáveis); welcome_message só para novos contatos (isNewContact); motor de fluxo no webhook |
| `Módulo - Redirecionadores.md` | **Atualizar** — melhorias: seletor de período 7/14/30d no painel expandido; sparkline preload automático para links visíveis (14d); loadAnalytics estável via refs (sem infinite loop); cache ${id}:${period}; confirmação inline ao pausar; slug sanitização defensiva; KPI "Cliques únicos (30d)" via RPC 066; KPI "Top link" com subtitle "total acumulado"; cloaking null-safe (decoy_url\|\|appUrl); onLoadAnalytics noop corrigido; status archived; migração 066 |
| `04 - Banco de Dados e Migrações.md` | Adicionar migrações 063–069: trigger_type+keywords (flows), flow_id/flow_node_id/flow_vars (contacts), redirects RLS + redirect_click_events + RPCs (065), redirect_unique_clicks_30d (066), remarketing bot_id+last_run_at+total_sent (067), remarketing next_run_at + remarketing_executions (068), remarketing cron índices + increment_campaign_sent RPC (069) |
| `03 - Estado do Projeto.md` | Marcar Remarketing como ✅ Funcional (auditoria completa + cron de envio real); marcar Redirecionadores e Fluxos/webhook/perfil-Telegram como ✅ |
| `Módulo - Afiliados.md` | **Atualizar** — /r/[slug] agora tem prioridade dupla: tenta afiliado primeiro, depois redirecionador |
| `Referência - Eventos PostHog.md` | **Atualizar** — 5 eventos campaign + csv_exported remarketing; total agora ~43 eventos |

## Como Atualizar

Sempre que uma feature nova for implementada ou uma migração for criada:
1. Atualizar o `CLAUDE.md` (fonte da verdade para Claude Code)
2. Atualizar a nota correspondente no Obsidian
3. Atualizar o checklist em `03 - Estado do Projeto.md`
4. Se nova migração: adicionar em `04 - Banco de Dados e Migrações.md`

## Fonte da Verdade

O arquivo `CLAUDE.md` neste repositório é a fonte de verdade para sessões de desenvolvimento com o Claude Code. O vault Obsidian é um espelho organizado para navegação humana.
