---
title: "Configurar notificações"
description: "Como escolher quais eventos geram notificação, por qual canal (e-mail, painel, Telegram) e configurar o horário de silêncio."
order: 1
category: "Notificações"
---

# Configurar notificações

**TL;DR:** Em Configurações → Notificações você decide quais eventos te avisam e por qual canal — e-mail, notificação no painel ou mensagem no Telegram. Você também pode silenciar notificações durante a madrugada.

---

## Como acessar

No menu lateral, clique em **"Configurações"** e depois em **"Notificações"**.

<!-- screenshot: tela de Notificações com os três canais visíveis -->

---

## Os 3 canais de notificação

### E-mail

Envia notificações para o e-mail da sua conta no Umbra Bot. Está sempre disponível — não precisa de configuração extra.

### Painel

Notificações aparecem como alertas dentro do próprio painel do Umbra Bot (aba Alertas + sino na topbar). Sempre ativo.

### Telegram

Envia as notificações diretamente para você via Telegram. Para usar esse canal, você precisa ter pelo menos um bot conectado à sua conta — as notificações chegam pelo seu próprio bot.

> **Se aparecer "Nenhum bot configurado":** Conecte um bot primeiro em [Gerenciar Bots](../02-bots/conectar-bot-umbra.md) e depois volte para ativar o canal Telegram.

---

## Escolher quais eventos notificam

A tabela principal mostra os eventos organizados em grupos. Para cada evento, você pode ativar ou desativar cada canal individualmente.

| Grupo | Exemplos de eventos |
|---|---|
| **Vendas e pagamentos** | Nova venda aprovada, estorno, chargeback |
| **Leads e contatos** | Novo lead capturado, carrinho abandonado |
| **Sistema e integrações** | Bot desconectado, gateway com falha |
| **Resumos** | Resumo diário, semanal, mensal |

<!-- screenshot: tabela de eventos com toggles por canal -->

Para ativar ou desativar uma coluna inteira (ex: desativar todos os avisos por e-mail), clique no cabeçalho do canal.

---

## Horário de silêncio

O horário de silêncio bloqueia notificações durante períodos que você não quer ser incomodado — como durante a madrugada.

Para configurar:

**1.** Ative o toggle **"Silêncio no horário"**

**2.** Defina o horário de início (padrão: 22:00) e o horário de término (padrão: 07:00)

**3.** Decida se eventos críticos passam pelo silêncio:
   - Ativado: bot desconectado, gateway com falha e chargeback **chegam mesmo no silêncio**
   - Desativado: **nenhuma** notificação chega no horário de silêncio

<!-- screenshot: card de horário de silêncio com toggles e pickers de horário -->

---

## Salvar as configurações

Depois de fazer as alterações, clique em **"Salvar"** no rodapé da página. As configurações ficam ativas imediatamente.

Se quiser descartar as mudanças antes de salvar, clique em **"Descartar"**.

Para voltar às configurações originais, clique em **"Restaurar padrão"**.
