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
| `04 - Banco de Dados e Migrações.md` | 61 migrações, schema, RLS, RPCs, triggers |
| `05 - Segurança.md` | AES-256-GCM, CSP, IDOR, RLS, rate limit |
| `06 - Variáveis de Ambiente.md` | Todas as envs documentadas |
| `Módulo - Dashboard e KPIs.md` | KPIs, deltas, gráfico |
| `Módulo - Financeiro.md` | Transactions, withdrawals, invoices, bank_accounts |
| `Módulo - Analytics.md` | Funil, coorte, UTM, filtros SQL |
| `Módulo - Atividade.md` | activity_events, Realtime, TTL, backfill |
| `Módulo - Alertas.md` | Alertas reais, TTL 30d, resolved_by_id, source |
| `Módulo - Notificações.md` | notification_prefs, upsert, canais |
| `Módulo - Clientes.md` | Contacts, Realtime, sort, timeline, CSV |
| `Módulo - Afiliados.md` | CRUD, /r/[slug], comissão, cookie de atribuição |
| `Referência - Eventos PostHog.md` | 28 eventos rastreados |
| `Referência - Onboarding Wizard.md` | 4 passos, localStorage, gateway |
| `Referência - Busca Global.md` | 14 tabelas, race condition, debounce |
| `Referência - Cron Jobs.md` | 4 crons no vercel.json |

## Como Atualizar

Sempre que uma feature nova for implementada ou uma migração for criada:
1. Atualizar o `CLAUDE.md` (fonte da verdade para Claude Code)
2. Atualizar a nota correspondente no Obsidian
3. Atualizar o checklist em `03 - Estado do Projeto.md`
4. Se nova migração: adicionar em `04 - Banco de Dados e Migrações.md`

## Fonte da Verdade

O arquivo `CLAUDE.md` neste repositório é a fonte de verdade para sessões de desenvolvimento com o Claude Code. O vault Obsidian é um espelho organizado para navegação humana.
