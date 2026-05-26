---
title: "Criar seu primeiro fluxo em 5 minutos"
description: "Tutorial passo a passo: do clique em Novo fluxo até o bot respondendo no Telegram."
order: 2
category: "Fluxos de venda"
---

# Criar seu primeiro fluxo em 5 minutos

**TL;DR:** Clique em "Novo fluxo", escolha o template "Captura de lead", selecione o bot, clique em "Publicar". Mande `/start` no seu bot e veja a mágica acontecer.

---

## Antes de começar

Você precisa ter **pelo menos 1 bot conectado**. Se ainda não tem, siga primeiro [Conectar o bot ao Umbra Bot](../02-bots/conectar-bot-umbra.md).

---

## Passo 1 — Acesse Fluxos de venda

No menu lateral do painel, clique em **"Fluxos de venda"**.

<!-- screenshot: menu lateral com item "Fluxos de venda" destacado -->

Você vê a lista de fluxos (vazia na primeira vez) e dois botões: **Templates** e **Novo fluxo**.

---

## Passo 2 — Escolha um template

Clique em **"Templates"** no canto superior direito.

<!-- screenshot: modal de templates com chips de categoria no topo -->

Você vê 8 templates organizados em 5 categorias:

| Categoria | Templates |
|---|---|
| Começar | Fluxo em branco |
| Captura de leads | Captura de lead · Webinar / Aula gratuita |
| Vendas | Vendas simples · Recuperação de carrinho |
| Pós-venda | Pós-venda + upsell |
| Engajamento | Quiz / Diagnóstico · Reativação de inativos |

Para o tutorial, clique em **"Captura de lead"**.

> **Dica:** Você pode editar qualquer template depois. Eles são só um ponto de partida.

---

## Passo 3 — O editor abre

Você cai no editor com 5 nós já configurados:

```
Mensagem → Pergunta nome → Pergunta e-mail → Tag "lead" → Mensagem final
```

<!-- screenshot: editor com 5 nós conectados em coluna -->

Cada caixinha colorida é um **nó**. Cada linha conectando duas caixinhas é uma **aresta** (representa "depois deste nó, vai para esse").

---

## Passo 4 — Dê um nome ao fluxo

No topo do editor, troque o título de "Captura de lead" para algo seu — por exemplo: **"Captura de leads do Instagram"**.

<!-- screenshot: campo de nome do fluxo na topbar -->

---

## Passo 5 — Vincule o bot

Ainda na topbar, clique no dropdown **"Selecionar bot"** (ao lado do nome).

Escolha o bot que vai executar este fluxo.

<!-- screenshot: dropdown de seleção de bot -->

> **Atenção:** Sem bot vinculado, o fluxo não dispara para ninguém — ele só fica salvo como rascunho.

---

## Passo 6 — Personalize as mensagens (opcional)

Clique em qualquer nó. O painel **Inspetor** aparece à direita.

Por exemplo, clique no primeiro nó (Mensagem):

<!-- screenshot: nó selecionado mostrando inspector à direita -->

No campo "Mensagem", troque o texto. Você pode usar variáveis como `{nome}` que serão substituídas pela resposta do cliente.

---

## Passo 7 — Publique

Clique no botão verde **"Publicar"** no canto superior direito.

<!-- screenshot: botão Publicar destacado -->

Um toast aparece: **"Fluxo publicado! (v1)"**. Pronto.

---

## Passo 8 — Teste no Telegram

1. Abra o Telegram
2. Procure pelo seu bot (`@seu_username_do_bot`)
3. Mande `/start`

✅ A primeira mensagem do fluxo deve chegar **na hora**.

Responda o nome quando o bot perguntar. Responda o e-mail. A mensagem final chega com seu nome substituído em `{nome}`.

🎉 **Funcionou!**

---

## E agora?

- Volte ao painel → menu `...` do seu fluxo → **Análises**. Aí você vê quem passou pelo fluxo, em qual nó cada cliente está, etc.
- Adicione um nó **Oferta** ou **Botões** para vender depois da captura.
- Confira [todos os tipos de nós disponíveis](./tipos-de-nos.md).

---

## Não funcionou?

Veja [Como debugar um fluxo](./debugar-fluxo.md) — guia completo do que verificar quando o bot não responde.
