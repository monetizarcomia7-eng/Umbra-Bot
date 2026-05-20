---
title: "Entender o funil de conversão"
description: "O que é o funil de conversão, o que cada etapa representa e como usar os dados para melhorar seus resultados."
order: 2
category: "Análises"
---

# Entender o funil de conversão

**TL;DR:** O funil mostra em quantas pessoas chegaram em cada etapa — desde quem visitou sua página até quem comprou. Onde o número cai muito é onde você tem oportunidade de melhorar.

---

## O que é um funil de conversão

Um funil de conversão é uma forma visual de ver quantas pessoas passaram por cada etapa do processo de compra. O topo do funil tem sempre mais pessoas do que o fundo — é esperado que uma parte saia em cada etapa.

---

## As 4 etapas do funil no Umbra Bot

### 1. Visitou

Número de pessoas que acessaram sua página de vendas ou checkout.

> **Como é registrado:** Páginas que usam o rastreamento do Umbra Bot registram automaticamente cada visita. Se esse número estiver zerado, a página de vendas ainda não está conectada ao sistema de rastreamento.

### 2. Iniciou conversa

Número de pessoas que mandaram `/start` para o seu bot no Telegram.

> **Como é registrado:** Toda vez que alguém usa o comando `/start`, o sistema registra automaticamente. Esse número deve aumentar sozinho conforme as pessoas entram no bot.

### 3. Adicionou ao carrinho

Número de pessoas que iniciaram o processo de pagamento (abriram a cobrança PIX).

> **Como é registrado:** Registrado automaticamente quando a cobrança é gerada pelo sistema.

### 4. Comprou

Número de compras confirmadas (pagamento PIX aprovado).

> **Como é registrado:** Registrado quando o Mercado Pago confirma o pagamento.

<!-- screenshot: funil com as 4 etapas e percentuais entre elas -->

---

## Como ler os números

Entre cada etapa, o funil mostra a **taxa de conversão** — a porcentagem de pessoas que avançou para a próxima etapa.

**Exemplo:**
```
Visitou:           1.000 pessoas
Iniciou conversa:    400 pessoas  → 40% continuaram
Adicionou ao carrinho: 120 pessoas  → 30% continuaram
Comprou:              48 pessoas  → 40% finalizaram

Conversão total: 48 de 1.000 = 4,8%
```

---

## O que fazer com essas informações

| Gargalo | O que testar |
|---|---|
| Poucos visitantes chegam ao bot | Melhorar o CTA da página de vendas; verificar se o link do bot está visível |
| Muitos no bot, poucos geram cobrança | Revisar a mensagem de boas-vindas; criar urgência ou oferta |
| Muitos geram PIX, poucos pagam | Simplificar o processo; lembrar quem não pagou |

---

## Comparar períodos no funil

Ative o toggle **"Comparar"** na barra de filtros para ver o funil do período atual vs. o anterior. Setas indicam se cada etapa cresceu ou diminuiu.

---

## Próximo passo

👉 [Ver relatórios por bot e produto](./relatorios-por-bot.md)
