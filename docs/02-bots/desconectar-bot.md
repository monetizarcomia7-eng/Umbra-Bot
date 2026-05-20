---
title: "Bot desconectado — o que fazer"
description: "O que significa o status Offline, por que acontece e como reconectar seu bot em menos de 2 minutos."
order: 4
category: "Bots"
---

# Bot desconectado — o que fazer

**TL;DR:** Status "Offline" significa que o Telegram não está conseguindo se comunicar com o Umbra Bot. Na maioria dos casos, clicar em "Reconectar" resolve em segundos.

---

## O que significa "Offline"

Quando o status de um bot aparece como **"Offline"** na lista, significa que o Telegram tentou enviar mensagens para o bot e não conseguiu resposta.

Isso pode acontecer por:

- Instabilidade temporária nos servidores do Telegram
- Instabilidade temporária nos servidores do Umbra Bot
- Token do bot foi redefinido no BotFather
- O bot foi desativado ou bloqueado no BotFather

Na maioria das vezes é algo temporário e se resolve sozinho em minutos.

---

## Como o Umbra Bot monitora seus bots

O Umbra Bot verifica automaticamente a cada **30 minutos** se todos os seus bots estão respondendo.

Quando detecta um problema, ele:

1. Muda o status para **"Offline"** na lista de bots
2. Cria um **alerta crítico** na aba de Alertas
3. (Se você tiver notificações ativas) Manda um aviso para você

Quando o bot voltar a funcionar, o alerta é resolvido automaticamente e o status volta para **"Online"**.

<!-- screenshot: alerta de "Bot desconectado" na aba de Alertas -->

---

## Solução 1 — Reconectar pelo painel (resolve em 90% dos casos)

**1.1** No menu lateral, clique em **"Gerenciar Bots"**

**1.2** Clique no bot que está offline

**1.3** Na aba **"Geral"**, clique no botão **"Reconectar"**

<!-- screenshot: aba Geral com botão "Reconectar" destacado -->

**1.4** Aguarde alguns segundos. O status deve mudar para **"Online"**.

**1.5** Teste: abra o Telegram, pesquise pelo @usuário do bot e mande `/start`. A mensagem de boas-vindas deve chegar.

---

## Solução 2 — O token foi redefinido no BotFather

Se você ou alguém com acesso ao BotFather gerou um novo token para o bot, o token antigo para de funcionar. Isso desconecta o bot.

Para resolver:

**2.1** No BotFather, mande `/mybots` e escolha o bot

**2.2** Clique em **"API Token"** e copie o novo token

**2.3** No Umbra Bot, abra os detalhes do bot

**2.4** Clique em **"Revelar token"**, depois em **"Alterar token"** (ou remova o bot e adicione novamente com o novo token)

<!-- TODO: confirmar se existe campo "Alterar token" na interface atual ou se é necessário remover e re-adicionar o bot -->

---

## Solução 3 — O bot foi bloqueado no BotFather

Se você entrou no BotFather e usou os comandos `/deletebot` ou `/setjoingroups` de forma que desativou o bot, você precisa verificar o status no próprio BotFather.

No BotFather, mande `/mybots` e confirme se o bot ainda está ativo na lista.

---

## Testar se o bot está funcionando

Após qualquer um dos passos acima, sempre faça um teste:

1. Abra o Telegram
2. Pesquise pelo @usuário do seu bot
3. Mande `/start`
4. A mensagem de boas-vindas deve chegar em menos de 5 segundos

Se chegar, está tudo certo. Se não chegar, tente a próxima solução.

---

## Minhas mensagens estão chegando mas o status ainda diz Offline

O painel atualiza o status a cada 30 minutos (ciclo automático do sistema). Se você reconectou o bot manualmente e as mensagens estão chegando normalmente, o status vai atualizar na próxima verificação automática.

Você pode forçar a atualização clicando em **"Reconectar"** novamente — isso faz o sistema verificar imediatamente.

---

## O problema persiste

Se nenhuma das soluções acima resolver:

1. Tente acessar o Telegram pelo celular — se o próprio Telegram estiver instável, os bots de todo mundo ficam offline temporariamente
2. Aguarde 30 minutos e verifique novamente
3. Se continuar offline, entre em contato com o suporte do Umbra Bot

<!-- TODO: adicionar link para o canal de suporte quando definido -->

---

## Prevenir desconexões

Para reduzir a chance de desconexões:

- **Não regenere o token** sem necessidade — cada vez que você gera um token novo no BotFather, o anterior para de funcionar
- **Ative as notificações** para saber imediatamente quando um bot desconectar: Configurações → Notificações → ativar "Bot desconectado"
- **Não use o token do bot em outros sistemas** — se outro sistema sobrescrever a configuração, o Umbra Bot perde a conexão

<!-- screenshot: configuração de notificação "Bot desconectado" ativada -->
