---
title: "Entender a lista de clientes"
description: "O que são leads e compradores, o que cada coluna significa e como navegar pela lista de clientes."
order: 1
category: "Clientes"
---

# Entender a lista de clientes

**TL;DR:** Todo mundo que manda `/start` pro seu bot vira um contato na lista. Quem fez pelo menos uma compra aparece como "Comprador" — os demais são "Leads".

---

## Como acessar

No menu lateral, clique em **"Clientes"**.

<!-- screenshot: menu lateral com item "Clientes" destacado -->

---

## Lead vs. Comprador

O Umbra Bot classifica automaticamente cada pessoa em dois grupos:

| Classificação | Critério |
|---|---|
| **Lead** | Entrou no bot mas ainda não comprou |
| **Comprador** | Fez pelo menos uma compra confirmada |

Essa classificação é atualizada em tempo real — assim que uma compra é aprovada, o lead vira comprador automaticamente.

---

## Os 3 números no topo

No topo da página, você vê um resumo:

- **Total de contatos:** todos na sua lista
- **Compradores:** quantos já compraram
- **Leads:** quantos ainda não compraram

<!-- screenshot: números de resumo no topo da tela de Clientes -->

---

## Colunas da tabela

| Coluna | O que mostra |
|---|---|
| **Nome** | Nome que a pessoa usa no Telegram |
| **Origem** | De onde veio (ex: instagram, google, whatsapp) |
| **Status** | Lead ou Comprador |
| **Compras** | Número de compras confirmadas |
| **Total gasto** | Soma de todas as compras em reais |
| **Último contato** | Quando a pessoa interagiu pela última vez com o bot |

---

## Abrir o perfil de um cliente

Clique em qualquer linha da tabela para abrir o painel lateral com o perfil completo do cliente.

<!-- screenshot: painel lateral aberto com perfil de um cliente -->

No perfil você vê:

- Dados de contato (nome, @usuário, e-mail, telefone)
- Histórico de atividade (quando entrou no bot, quando comprou, etc.)
- Tags adicionadas
- Ticket médio e total gasto

---

## Apagar um cliente

Abra o perfil do cliente e clique em **"Apagar cliente"** no rodapé do painel lateral. Uma confirmação vai aparecer antes de apagar — a ação é permanente.

> **Nota:** Apagar um cliente remove o contato da lista, mas não apaga as transações associadas a ele no painel financeiro.

---

## Próximo passo

👉 [Filtrar e ordenar clientes](./filtrar-clientes.md)
