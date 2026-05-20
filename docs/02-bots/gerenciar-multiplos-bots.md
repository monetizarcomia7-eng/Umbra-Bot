---
title: "Gerenciar múltiplos bots"
description: "Como organizar, monitorar e alternar entre vários bots no Umbra Bot."
order: 3
category: "Bots"
---

# Gerenciar múltiplos bots

**TL;DR:** Você pode ter quantos bots quiser no Umbra Bot. Cada bot aparece na lista com seu status, número de leads e receita. Clique em qualquer um para editar ou ver os detalhes.

---

## Por que ter mais de um bot

Muitos vendedores usam bots diferentes para cada produto, nicho ou canal de divulgação. Exemplos comuns:

- Um bot para cada produto digital que você vende
- Um bot para tráfego pago e outro para orgânico
- Um bot em português e outro em inglês
- Um bot de vendas e um bot de suporte ao cliente

No Umbra Bot, todos ficam centralizados em um único painel.

---

## A tela de Gerenciar Bots

No menu lateral, clique em **"Gerenciar Bots"** para ver todos os seus bots.

<!-- screenshot: tela de Gerenciar Bots com múltiplos bots listados -->

Para cada bot, você vê na lista:

| Informação | O que significa |
|---|---|
| **Status** | Online (funcionando) ou Offline (desconectado) |
| **Nome** | O nome interno que você deu ao bot |
| **@usuário** | O endereço do bot no Telegram |
| **Leads** | Quantas pessoas entraram no bot |
| **Vendas** | Quantas transações foram feitas |
| **Receita** | Total em reais gerado pelo bot |

---

## Adicionar mais bots

Para adicionar um novo bot, clique em **"+ Adicionar Bot"** no canto superior direito.

Cada bot precisa de um token diferente. Você cria quantos bots quiser no BotFather (são gratuitos) e conecta cada um ao Umbra Bot separadamente.

→ Veja o passo a passo completo em [Como criar um bot no BotFather](./como-criar-bot-botfather.md)

---

## Editar um bot existente

Clique no nome do bot na lista para abrir o painel de detalhes.

<!-- screenshot: painel de detalhes de um bot aberto -->

Você pode editar:
- Nome interno
- Descrição
- Mensagem de boas-vindas (com variáveis `{nome}`, `{bot}`, `{data}`)
- Fluxo de venda vinculado

Depois de editar, clique em **"Salvar"** para aplicar as mudanças.

---

## Monitorar o status dos bots

O Umbra Bot verifica a cada 30 minutos se todos os seus bots estão funcionando corretamente.

Se algum bot desconectar, você recebe um **alerta** na aba de Alertas e vê o status mudar para **"Offline"** na lista de bots.

<!-- screenshot: bot com status "Offline" na lista -->

Quando o bot reconectar automaticamente, o status volta para **"Online"** e o alerta é resolvido sozinho.

> **Dica:** Ative as notificações em **"Configurações → Notificações"** para receber um aviso no Telegram ou por e-mail quando um bot desconectar.

---

## Reativar um bot offline

Se um bot estiver como "Offline" e não voltar automaticamente:

1. Clique no bot na lista para abrir os detalhes
2. Na aba **"Geral"**, você vai ver um botão **"Reconectar"**
3. Clique em **"Reconectar"** e aguarde

<!-- screenshot: aba Geral com botão "Reconectar" visível quando bot está offline -->

Se o problema persistir, veja o artigo [Bot desconectado — o que fazer](./desconectar-bot.md).

---

## Pausar ou remover um bot

### Pausar temporariamente

<!-- TODO: confirmar se existe opção de pausar bot sem deletar na interface atual -->

### Remover um bot permanentemente

Para remover um bot:

1. Abra os detalhes do bot
2. No menu de opções (ícone de três pontos), clique em **"Remover bot"**
3. Confirme a remoção

> **Atenção:** Remover o bot do Umbra Bot não apaga o bot do Telegram. Ele continua existindo lá, mas fica sem comportamento configurado (voltará a ser um bot vazio). Para apagar o bot do Telegram também, use o BotFather com o comando `/deletebot`.

---

## Ver os dados de um bot específico

Nas telas de **Clientes**, **Financeiro** e **Atividade**, você pode filtrar os dados por bot usando o seletor de bot no topo da página.

Isso é útil para comparar o desempenho de cada bot e entender qual canal de divulgação traz mais resultado.

<!-- screenshot: filtro de bot na tela de Atividade -->

---

## Próximo passo

Aprenda o que fazer quando um bot fica offline.

👉 [Bot desconectado — o que fazer](./desconectar-bot.md)
