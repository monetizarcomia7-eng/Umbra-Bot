---
title: "Do zero ao primeiro PIX confirmado"
description: "Guia completo para sair do zero e receber seu primeiro pagamento via PIX no mesmo dia, usando o Telegram e o Mercado Pago."
order: 4
category: "Começando"
---

# Do zero ao primeiro PIX confirmado

**TL;DR:** Em menos de 1 hora você configura o bot, conecta o Mercado Pago e está pronto para receber PIX de verdade. Siga cada passo nesta ordem e não pule nenhum.

---

## O que você vai precisar

Antes de começar, certifique-se de ter:

- [ ] Conta no Umbra Bot criada (→ [como criar](./criar-conta.md))
- [ ] Aplicativo do Telegram instalado no celular
- [ ] Conta no Mercado Pago com CPF verificado
- [ ] Produto ou serviço que você quer vender

> **Por que o Mercado Pago?** É a única forma de receber PIX disponível no Umbra Bot no momento. A conta é gratuita e o saque cai na sua conta bancária.

---

## Etapa 1 — Criar seu bot no Telegram

Se você ainda não tem um bot no Telegram, crie agora. São 3 minutos.

**1.1** Abra o Telegram e pesquise por **@BotFather**

**1.2** Mande o comando `/newbot`

**1.3** Escolha um nome para o bot (ex: `Vendas da Maria`) e um @usuário que termine em `bot` (ex: `vendasdamaria_bot`)

**1.4** O BotFather vai te enviar um **token** — um código longo. **Copie e guarde esse código.**

<!-- screenshot: BotFather mostrando o token após criação do bot -->

> **Dica:** Salve o token num bloco de notas antes de continuar. Você vai precisar dele no próximo passo.

---

## Etapa 2 — Conectar o bot ao Umbra Bot

**2.1** No painel do Umbra Bot, clique em **"Gerenciar Bots"** no menu lateral

**2.2** Clique em **"+ Adicionar Bot"**

**2.3** Cole o token que o BotFather te enviou e clique em **"Verificar"**

**2.4** O Umbra Bot vai reconhecer o bot e pedir mais algumas informações:
- Nome interno (como você quer chamar)
- Mensagem de boas-vindas (o que o bot manda quando alguém escreve `/start`)

**2.5** Clique em **"Salvar"**

Quando aparecer o status **"Online"** ao lado do nome do bot, a conexão foi feita com sucesso.

<!-- screenshot: bot com badge "Online" na tela de Gerenciar Bots -->

> **Teste agora:** Abra o Telegram, pesquise pelo @usuário do seu bot e mande `/start`. Você deve receber a mensagem de boas-vindas. Se não receber, veja [o que fazer quando o bot está offline](../02-bots/desconectar-bot.md).

---

## Etapa 3 — Conectar o Mercado Pago

Para receber PIX, você precisa conectar sua conta do Mercado Pago ao Umbra Bot.

**3.1** Acesse sua conta no **Mercado Pago** (mercadopago.com.br)

**3.2** No menu, vá em **"Seu negócio" → "Configurações" → "Credenciais"**

<!-- screenshot: área de credenciais do Mercado Pago -->

**3.3** Copie o **Access Token de Produção** — começa com `APP_USR-`

> **Atenção:** Use o token de **Produção**, não o de teste. O token de teste só funciona com pagamentos simulados e não deposita dinheiro real.

**3.4** No Umbra Bot, clique em **"Configurações"** no menu lateral (ou use o assistente de configuração inicial se ainda não tiver fechado)

**3.5** Na seção de gateways de pagamento, localize o **Mercado Pago** e cole o Access Token

**3.6** Clique em **"Salvar"**

<!-- screenshot: seção de gateways com campo do Mercado Pago preenchido -->

Pronto — a partir de agora, quando alguém pagar via PIX na sua plataforma, o dinheiro vai direto para sua conta no Mercado Pago.

<!-- TODO: confirmar fluxo exato de onde salvar o Access Token do Mercado Pago na interface atual -->

---

## Etapa 4 — Criar um link de pagamento

Com o bot no ar e o Mercado Pago conectado, você precisa de um link que direcione seus clientes para o pagamento.

<!-- TODO: confirmar se existe editor de fluxos ou gerador de link de pagamento disponível na versão atual — documentar quando lançado -->

> **Nota:** O módulo de fluxos de venda (que gera links de pagamento automáticos diretamente pelo bot) está em desenvolvimento. Enquanto isso, você pode usar sua conta no Mercado Pago para gerar links de cobrança e compartilhar pelo Telegram.

**Alternativa disponível agora:**

**4.1** No Mercado Pago, acesse **"Cobrar"** e crie um link de pagamento com o valor do seu produto

**4.2** Copie o link gerado

**4.3** Na mensagem de boas-vindas do seu bot (em Gerenciar Bots → editar bot), inclua o link de pagamento

**4.4** Quando alguém enviar `/start`, o bot manda a mensagem com o link automaticamente

---

## Etapa 5 — Fazer o primeiro teste

Antes de divulgar para seus clientes, faça um teste completo:

**5.1** Abra o Telegram e pesquise pelo seu bot

**5.2** Mande `/start` — a mensagem de boas-vindas deve chegar

**5.3** Clique no link de pagamento

**5.4** Faça um pagamento de R$ 1,00 via PIX (para testar)

**5.5** No painel do Umbra Bot, acesse **"Financeiro"** — a transação deve aparecer em alguns segundos

<!-- screenshot: tela do Financeiro com a primeira transação aparecendo -->

**5.6** Verifique também em **"Clientes"** — o nome de quem pagou deve estar lá

<!-- screenshot: tela de Clientes com o primeiro contato listado -->

> **Não apareceu nada?** Aguarde 1 minuto e atualize a página. Pagamentos PIX levam alguns segundos para confirmar. Se ainda não aparecer, verifique se o Access Token do Mercado Pago está correto.

---

## Etapa 6 — Divulgar

Com tudo funcionando, é hora de mandar o link do seu bot para seus clientes.

O link do seu bot é sempre:
```
https://t.me/SEU_USERNAME_DO_BOT
```

Substitua `SEU_USERNAME_DO_BOT` pelo @usuário que você criou no BotFather (sem o @).

**Exemplos de onde divulgar:**
- Bio do Instagram
- Stories com link
- Grupo do WhatsApp
- Descrição do YouTube
- E-mail para sua lista

---

## Acompanhar os resultados

Com tudo no ar, use o painel do Umbra Bot para acompanhar:

| Onde | O que você vê |
|---|---|
| **Dashboard** | Receita total, número de vendas, bots ativos |
| **Financeiro** | Cada transação, valor, status |
| **Clientes** | Lista de todos que entraram no seu bot |
| **Atividade** | Feed em tempo real de tudo que acontece |

---

## Resumo do que você configurou

- ✅ Bot no Telegram criado e conectado ao Umbra Bot
- ✅ Mercado Pago integrado para receber PIX
- ✅ Mensagem de boas-vindas ativa
- ✅ Primeiros clientes chegando automaticamente

---

## Próximos passos recomendados

- [Personalizar a mensagem de boas-vindas do bot](../02-bots/conectar-bot-umbra.md)
- [Gerenciar múltiplos bots](../02-bots/gerenciar-multiplos-bots.md)
- [Entender o painel financeiro](../04-financeiro/entender-painel-financeiro.md)
