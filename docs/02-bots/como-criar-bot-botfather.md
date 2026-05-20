---
title: "Como criar um bot no BotFather"
description: "Passo a passo para criar seu bot no Telegram usando o BotFather, o criador oficial de bots."
order: 1
category: "Bots"
---

# Como criar um bot no BotFather

**TL;DR:** O BotFather é o bot oficial do Telegram para criar outros bots. Mande `/newbot`, escolha um nome e um @usuário, e em 2 minutos você tem o código necessário para conectar ao Umbra Bot.

---

## O que é o BotFather

O BotFather é um bot oficial do Telegram — identificado pelo selo azul de verificação — que permite criar e gerenciar bots. Pense nele como um "cartório de bots": você registra o seu lá e recebe um código único que identifica o bot.

Você não precisa saber programar. O BotFather faz tudo pelo chat.

---

## Passo 1 — Encontre o BotFather

No Telegram (celular ou desktop), use a barra de pesquisa e procure por:

```
@BotFather
```

Abra o resultado que tem o nome **BotFather** e o **selo azul de verificação** ao lado do nome. Não confunda com perfis falsos que imitam o nome — o oficial tem o selo.

<!-- screenshot: resultado da pesquisa por @BotFather com selo azul destacado -->

---

## Passo 2 — Inicie a conversa

Se for a primeira vez, clique em **"Iniciar"** ou mande o comando:

```
/start
```

O BotFather vai listar todos os comandos disponíveis.

<!-- screenshot: tela inicial da conversa com o BotFather mostrando os comandos -->

---

## Passo 3 — Crie um novo bot

Mande o comando:

```
/newbot
```

O BotFather vai fazer duas perguntas, uma de cada vez:

---

### Pergunta 1 — Nome do bot

O nome é o que aparece no cabeçalho da conversa para quem está falando com o bot. Pode ter espaços, letras maiúsculas e acentos.

**Exemplos:**
- `Vendas da Maria`
- `Suporte Premium`
- `Comunidade do João`

<!-- screenshot: BotFather perguntando o nome do bot -->

---

### Pergunta 2 — Username do bot

O username é o endereço único do bot no Telegram (o @usuário). Algumas regras obrigatórias:

- Precisa terminar com `bot` (ex: `vendasdamaria_bot` ou `vendasdaMariaBot`)
- Só letras, números e underscore (`_`)
- Sem espaços ou caracteres especiais
- Mínimo de 5 caracteres no total

**Exemplos:**
- `vendasdamaria_bot`
- `suportepremiumbr_bot`
- `joaocomunidade_bot`

Se o username que você escolheu já estiver em uso, o BotFather vai informar e pedir outro.

<!-- screenshot: BotFather perguntando o username do bot -->

---

## Passo 4 — Copie o token

Depois de confirmar o username, o BotFather vai enviar uma mensagem de parabéns com o **token** do bot. Parece com isso:

```
Done! Congratulations on your new bot. You will find it at t.me/SEU_BOT.
Use this token to access the HTTP API:

1234567890:ABCdefGHijklMNOpqrSTUvwxYZ-exemplo

Keep your token secure and store it safely...
```

O token é a sequência de números e letras após os dois pontos — no exemplo, `1234567890:ABCdefGHijklMNOpqrSTUvwxYZ-exemplo`.

**Copie o token completo** (incluindo os números antes dos dois pontos).

<!-- screenshot: mensagem do BotFather com o token gerado em destaque -->

> **Guarde em lugar seguro.** Quem tiver esse token consegue controlar o seu bot — enviar mensagens, ver contatos e muito mais. Não compartilhe com ninguém e não poste em redes sociais.

---

## Passo 5 — Verifique se o bot existe

No Telegram, pesquise pelo @usuário que você criou. Você deve encontrar o perfil do bot. Mande `/start` para ver se ele responde — por enquanto vai mostrar uma mensagem padrão do Telegram, pois ainda não configuramos o comportamento dele.

Isso é normal. O comportamento real (mensagem de boas-vindas, links de pagamento) será configurado no próximo passo, dentro do Umbra Bot.

---

## Se você perdeu o token

Não se preocupe — você pode recuperar o token a qualquer momento pelo BotFather.

No BotFather, mande:

```
/mybots
```

Escolha o bot desejado na lista e clique em **"API Token"**. O token aparece novamente.

<!-- screenshot: BotFather mostrando opção "API Token" ao clicar no bot -->

---

## Próximo passo

Com o token em mãos, vá para o Umbra Bot e conecte o bot.

👉 [Conectar o bot ao Umbra Bot](./conectar-bot-umbra.md)
