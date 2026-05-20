---
title: "Criar e conectar seu primeiro bot"
description: "Como criar um bot no Telegram e conectá-lo ao Umbra Bot em menos de 5 minutos."
order: 3
category: "Começando"
---

# Criar e conectar seu primeiro bot

**TL;DR:** Você cria o bot no próprio Telegram (via BotFather), copia o código que ele te dá e cola no Umbra Bot. São menos de 5 minutos.

---

## Antes de começar

Você vai precisar ter o aplicativo do **Telegram** instalado no celular ou desktop. É gratuito.

---

## Parte 1 — Criar o bot no Telegram

O Telegram tem um bot oficial chamado **BotFather** que cria bots para você. Pense nele como um "criador de bots" dentro do próprio Telegram.

### Passo 1 — Abra o BotFather

No Telegram, pesquise por **@BotFather** e abra a conversa. Vai aparecer um perfil com um ícone de robô e o selo azul de verificação — esse é o oficial.

<!-- screenshot: perfil do @BotFather no Telegram com selo de verificado -->

### Passo 2 — Crie um novo bot

Na conversa com o BotFather, envie o comando:

```
/newbot
```

O BotFather vai pedir duas informações:

1. **Nome do bot** — é o nome que aparece na conversa (ex: `Meu Bot de Vendas`). Pode ter espaços e acentos.
2. **Username do bot** — é o @usuário único no Telegram. Precisa terminar com `bot` (ex: `minhasloja_bot`). Sem espaços ou acentos.

<!-- screenshot: conversa com o BotFather pedindo nome e username do bot -->

### Passo 3 — Copie o token

Depois de confirmar o nome e o username, o BotFather vai te enviar uma mensagem com um **token** — um código longo parecido com este:

```
1234567890:ABCdefGHijklMNOpqrSTUvwxYZ
```

**Copie esse código.** Você vai precisar dele no próximo passo.

> **Importante:** Não compartilhe esse token com ninguém. Quem tiver esse código consegue controlar o seu bot.

<!-- screenshot: mensagem do BotFather mostrando o token gerado -->

---

## Parte 2 — Conectar o bot ao Umbra Bot

### Passo 4 — Vá para Gerenciar Bots

No painel do Umbra Bot, clique em **"Gerenciar Bots"** no menu lateral.

<!-- screenshot: menu lateral do Umbra Bot com item "Gerenciar Bots" destacado -->

### Passo 5 — Adicione o bot

Clique no botão **"+ Adicionar Bot"** no canto superior direito.

<!-- screenshot: botão "Adicionar Bot" na página de Gerenciar Bots -->

### Passo 6 — Cole o token

Na janela que abrir, cole o token que o BotFather te enviou e clique em **"Verificar"**.

O Umbra Bot vai confirmar que o token é válido e mostrar o nome e o @usuário do seu bot.

<!-- screenshot: campo para colar o token com botão "Verificar" -->

### Passo 7 — Configure e salve

Preencha as informações do bot:

- **Nome** — como você quer chamar internamente
- **Descrição** — para sua organização (opcional)
- **Mensagem de boas-vindas** — o que o bot vai responder quando alguém mandar `/start`

Clique em **"Salvar"**. O Umbra Bot vai conectar o bot ao Telegram automaticamente.

Quando aparecer o status **"Online"**, o bot está funcionando.

<!-- screenshot: bot com status "Online" na lista de bots -->

---

## Testar se funcionou

Abra o Telegram, pesquise pelo @usuário do seu bot e mande `/start`. Você deve receber a mensagem de boas-vindas que configurou.

Se não receber nada em 30 segundos, veja o artigo [Bot desconectado — o que fazer](../02-bots/desconectar-bot.md).

---

## Próximo passo

Com o bot no ar, o próximo passo é configurar o Mercado Pago e receber o seu primeiro PIX.

👉 [Do zero ao primeiro PIX confirmado](./primeiro-pix.md)
