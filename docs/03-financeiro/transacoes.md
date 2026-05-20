---
title: "Transações — status e detalhes"
description: "O que significa cada status de transação e como ver os detalhes de uma venda específica."
order: 2
category: "Financeiro"
---

# Transações — status e detalhes

**TL;DR:** Cada linha na aba Transações é uma cobrança gerada. O status mostra em que etapa ela está — aprovada é dinheiro no bolso, pendente ainda está esperando o pagamento.

---

## O que é uma transação

Uma transação é criada toda vez que alguém gera uma cobrança PIX na sua plataforma. Ela aparece imediatamente na lista — mesmo antes do pagamento ser confirmado.

---

## Status possíveis

| Status | O que significa |
|---|---|
| **Aprovada** | Pagamento confirmado. Valor entra no saldo disponível. |
| **Pendente** | PIX gerado, aguardando o pagamento do comprador. |
| **Expirado** | O comprador não pagou dentro do prazo (geralmente 30 minutos). |
| **Cancelado** | Cobrança cancelada antes do pagamento. |
| **Falhou** | Houve um problema no processamento (estorno, chargeback). |

> **Dica:** Transações com status "Pendente" expiram automaticamente se não forem pagas. Isso é normal — muitos compradores geram o PIX e não completam o pagamento.

---

## Entender os valores

Para cada transação aprovada, você vê três valores:

| Campo | O que é |
|---|---|
| **Valor bruto** | O que o comprador pagou |
| **Taxa** | Desconto do Mercado Pago pelo processamento |
| **Valor líquido** | O que entra no seu saldo (bruto − taxa) |

---

## Ver os detalhes de uma transação

Clique em qualquer linha da tabela para expandir os detalhes.

<!-- screenshot: linha expandida mostrando detalhes da transação -->

Nos detalhes, você vê:

- **Comprador:** nome e e-mail (quando disponíveis)
- **Produto:** nome do produto
- **Gateway:** Mercado Pago
- **Bot:** qual bot capturou o lead
- **Fluxo:** qual fluxo de venda originou a transação (quando configurado)
- **Origem (UTM):** de onde veio o tráfego (ex: instagram, google)
- **Campanha:** nome da campanha de marketing (quando informado)
- **Método:** forma de pagamento (PIX)

---

## Filtrar e buscar transações

<!-- TODO: confirmar se existe campo de busca por nome/produto na aba Transações -->

Use o seletor de período no topo para filtrar por janela de tempo. Para visualizações mais longas, o botão **"Carregar mais"** aparece ao final da lista e carrega transações mais antigas.

---

## Carregar mais transações

Por padrão, o painel exibe as transações mais recentes. Se você precisar ver transações mais antigas, role até o final da lista e clique em **"Carregar mais"**.

<!-- screenshot: botão "Carregar mais" no final da lista de transações -->

---

## Próximo passo

👉 [Como solicitar um saque](./solicitar-saque.md)
