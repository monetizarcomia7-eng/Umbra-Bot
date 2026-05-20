---
title: "Entender o painel financeiro"
description: "O que cada número significa no painel financeiro do Umbra Bot: saldo, receita, saques e faturas."
order: 1
category: "Financeiro"
---

# Entender o painel financeiro

**TL;DR:** O painel financeiro mostra em tempo real quanto você recebeu, quanto está disponível para saque e o histórico completo de cada transação.

---

## Como acessar

No menu lateral, clique em **"Financeiro"**.

<!-- screenshot: menu lateral com item "Financeiro" destacado -->

---

## Os 4 cards do topo

Ao entrar no painel, você vê 4 números principais:

### Saldo disponível

O valor que você pode sacar agora. É calculado automaticamente: receita aprovada menos saques já feitos.

### A liberar

Pagamentos que foram confirmados mas ainda estão dentro do prazo de liquidação do Mercado Pago. Geralmente libera em 1 a 2 dias úteis.

### Total recebido

Soma de tudo que você recebeu no período selecionado — independente de já ter sacado ou não.

### Taxas da plataforma

Taxas cobradas pelo Mercado Pago e pelo Umbra Bot sobre as transações do período.

<!-- screenshot: os 4 cards do topo com valores de exemplo -->

---

## Seletor de período

No canto superior direito do painel, você pode filtrar os dados por:

| Período | O que mostra |
|---|---|
| **7 dias** | Última semana |
| **30 dias** | Último mês (padrão) |
| **90 dias** | Últimos 3 meses |
| **Tudo** | Todo o histórico |

Os cards do topo e as tabelas abaixo se atualizam automaticamente quando você muda o período.

---

## As três abas

### Transações

Lista cada cobrança gerada, com:
- Data e hora
- Nome do comprador
- Produto
- Valor bruto, taxa e valor líquido
- Status

→ Veja mais em [Entender as transações](./transacoes.md)

### Saques

Histórico de todos os saques solicitados, com status (pendente, processando, concluído ou falhou).

→ Veja mais em [Solicitar saque](./solicitar-saque.md)

### Faturas

<!-- TODO: confirmar quando o módulo de billing for ativado — atualmente a aba exibe "Nenhuma fatura gerada ainda" enquanto o sistema de planos não está ativo -->

Faturas do seu plano no Umbra Bot. Se a aba estiver vazia, é porque o módulo de planos ainda não foi ativado para sua conta.

---

## Exportar dados

No canto superior direito de cada aba, há um botão **"Exportar CSV"**. Ele baixa uma planilha com todos os dados do período selecionado — útil para declaração de IR ou controle financeiro próprio.

<!-- screenshot: botão "Exportar CSV" na aba de Transações -->

---

## Próximo passo

👉 [Entender os status das transações](./transacoes.md)
