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
| `Módulo - Redirecionadores.md` | SSR + RedirectsClient, CRUD real, analytics lazy, cloaking, redirect_click_events, RPCs |
| `Módulo - Documentação.md` | /docs/ 30 artigos, /dashboard/docs renderizador, marked, toggle tema |
| `Referência - Eventos PostHog.md` | 32 eventos rastreados (inclui redirect_created/updated/status_changed/deleted) |
| `Referência - Onboarding Wizard.md` | 4 passos, localStorage, gateway |
| `Referência - Busca Global.md` | 14 tabelas, race condition, debounce |
| `Referência - Cron Jobs.md` | 4 crons no vercel.json |

## Notas a criar/atualizar no Vault após esta sessão

| Nota | O que atualizar |
|---|---|
| `Módulo - Fluxos.md` | **Atualizar** — adicionar: motor de execução de fluxo no webhook (executeFlowNode recursivo, 9 tipos de nó), migração 064 (flow_id/flow_node_id/flow_vars em contacts), correção inspector (bgPannedRef), correção campo Question (data.text ?? data.question) |
| `Módulo - Bots.md` | **Atualizar** — 9 server actions (+ getBotTelegramProfileAction, saveBotTelegramProfileAction, setBotPhotoAction); TelegramProfileModal (foto base64, nome, descrição, short desc, comandos reordenáveis); welcome_message só para novos contatos (isNewContact); motor de fluxo no webhook |
| `Módulo - Redirecionadores.md` | **Criar** — módulo completo: SSR page.tsx + RedirectsClient, CRUD real (.eq user_id), analytics lazy via RPC redirect_analytics (by_day/source/device), cloaking (decoy_url para bots), UTM nullable, redirect_type 301/302, rota /r/[slug] com rastreamento (IP hash, device, referrer), tabela redirect_click_events, RPCs record_redirect_click + redirect_analytics, migração 065, 4 eventos PostHog + csv_exported |
| `04 - Banco de Dados e Migrações.md` | Adicionar migração 063 (trigger_type + keywords em flows), migração 064 (flow_id/flow_node_id/flow_vars em contacts) e migração 065 (redirects user_id + RLS + redirect_click_events + RPCs) |
| `03 - Estado do Projeto.md` | Marcar itens de fluxo/webhook/perfil-telegram como ✅; marcar Redirecionadores como ✅ Funcional |
| `Módulo - Afiliados.md` | **Atualizar** — /r/[slug] agora tem prioridade dupla: tenta afiliado primeiro, depois redirecionador |
| `Referência - Eventos PostHog.md` | **Atualizar** — adicionar 4 eventos de redirect (redirect_created, redirect_updated, redirect_status_changed, redirect_deleted); total agora 32 eventos |

## Como Atualizar

Sempre que uma feature nova for implementada ou uma migração for criada:
1. Atualizar o `CLAUDE.md` (fonte da verdade para Claude Code)
2. Atualizar a nota correspondente no Obsidian
3. Atualizar o checklist em `03 - Estado do Projeto.md`
4. Se nova migração: adicionar em `04 - Banco de Dados e Migrações.md`

## Fonte da Verdade

O arquivo `CLAUDE.md` neste repositório é a fonte de verdade para sessões de desenvolvimento com o Claude Code. O vault Obsidian é um espelho organizado para navegação humana.
