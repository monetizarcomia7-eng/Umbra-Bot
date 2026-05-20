---
title: "Conectar o bot ao Umbra Bot"
description: "Como adicionar seu bot do Telegram ao painel do Umbra Bot e configurar a mensagem de boas-vindas."
order: 2
category: "Bots"
---

# Conectar o bot ao Umbra Bot

**TL;DR:** Cole o token do BotFather na tela de "Gerenciar Bots", configure a mensagem de boas-vindas e clique em Salvar. O bot fica online em segundos.

---

## O que você vai precisar

- Token do seu bot (obtido no BotFather — veja [como criar um bot](./como-criar-bot-botfather.md))
- Conta no Umbra Bot ativa

---

## Passo 1 — Acesse Gerenciar Bots

No menu lateral do painel, clique em **"Gerenciar Bots"**.

<!-- screenshot: menu lateral com item "Gerenciar Bots" destacado -->

Se você ainda não tem nenhum bot cadastrado, a tela vai mostrar uma mensagem de estado vazio. Se já tiver bots, eles aparecem listados.

---

## Passo 2 — Adicione um novo bot

Clique no botão **"+ Adicionar Bot"** no canto superior direito da tela.

<!-- screenshot: botão "+ Adicionar Bot" na tela de Gerenciar Bots -->

Uma janela vai abrir com um formulário de três etapas.

---

## Passo 3 — Cole o token e verifique

**Etapa 1 da janela:** Cole o token do BotFather no campo indicado e clique em **"Verificar"**.

O Umbra Bot vai confirmar com o Telegram que o token é válido e vai mostrar:
- O nome do bot
- O @usuário do bot
- Um ícone de confirmação verde

<!-- screenshot: campo de token preenchido com confirmação verde após verificar -->

> **Token inválido?** Verifique se copiou o token completo — deve ter números, dois pontos e letras. Tente copiar novamente direto da mensagem do BotFather.

---

## Passo 4 — Configure as informações do bot

**Etapa 2 da janela:** Preencha as informações do bot:

### Nome interno

Como você quer ver esse bot na sua lista. Não aparece para os seus clientes — é só para sua organização.

Exemplo: `Bot de Vendas — Instagram` ou `Suporte VIP`

### Descrição (opcional)

Uma nota rápida para você lembrar para que serve esse bot.

### Mensagem de boas-vindas

Essa é a mensagem que o bot manda automaticamente para toda pessoa que enviar `/start` pela primeira vez.

Você pode usar variáveis para personalizar a mensagem:

| Variável | O que substitui |
|---|---|
| `{nome}` | O primeiro nome do contato no Telegram |
| `{bot}` | O nome do seu bot |
| `{data}` | A data de hoje |

**Exemplo de mensagem:**

```
Olá, {nome}! 👋

Seja bem-vindo ao {bot}.

Aqui você encontra [descreva o que o bot oferece].

👇 Clique no link abaixo para continuar:
[seu link aqui]
```

> **Dica:** Seja direto. A mensagem de boas-vindas é o primeiro contato do seu cliente com o bot — deixe claro o que ele vai encontrar e o que deve fazer.

<!-- screenshot: campo de mensagem de boas-vindas com exemplo preenchido -->

---

## Passo 5 — Salve e ative

**Etapa 3 da janela:** Revise as informações e clique em **"Salvar"**.

O Umbra Bot vai:
1. Salvar as configurações do bot
2. Registrar o bot no Telegram automaticamente
3. Mudar o status para **"Online"**

<!-- screenshot: bot com status "Online" na lista de bots -->

---

## Testar a conexão

Abra o Telegram, pesquise pelo @usuário do seu bot e mande `/start`.

Você deve receber a mensagem de boas-vindas que configurou em alguns segundos.

**Se não receber:**
- Aguarde 30 segundos e tente novamente
- Verifique se o status no painel está como "Online"
- Veja o artigo [Bot desconectado — o que fazer](./desconectar-bot.md)

---

## Configurações adicionais do bot

Depois de salvar, você pode editar o bot a qualquer momento clicando nele na lista. As abas disponíveis são:

### Aba Geral

Editar nome, descrição e mensagem de boas-vindas. Também mostra o status da conexão e permite reativar o bot se ele desconectar.

### Aba Fluxo

<!-- TODO: confirmar estado atual da aba Fluxo — documentar quando o módulo de fluxos de venda for lançado -->

Vincula um fluxo de venda ao bot. Disponível quando você criar fluxos no módulo de Fluxos.

### Token

Mostra o token do bot de forma ocultada. Para ver o token completo, clique em **"Revelar"** — o token aparece por alguns segundos para você copiar se precisar.

> **Segurança:** O token fica criptografado no sistema. Mesmo a equipe do Umbra Bot não consegue lê-lo. Ele só é mostrado quando você clica em "Revelar" na sua conta.

---

## Próximo passo

Com o bot conectado, aprenda a gerenciar vários bots de forma organizada.

👉 [Gerenciar múltiplos bots](./gerenciar-multiplos-bots.md)
