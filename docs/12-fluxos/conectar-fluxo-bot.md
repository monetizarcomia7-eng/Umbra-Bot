---
title: "Conectar o fluxo ao bot"
description: "Como vincular um fluxo a um bot do Telegram para ele realmente disparar."
order: 6
category: "Fluxos de venda"
---

# Conectar o fluxo ao bot

**TL;DR:** No editor do fluxo, escolha o bot no dropdown da topbar. Depois clique em "Publicar". Sem isso, o fluxo é só rascunho que nunca dispara.

---

## Por que isso importa

Um fluxo **publicado mas sem bot vinculado** não dispara para ninguém. Você pode criar, salvar, editar — mas se ninguém apertar `/start` num bot que aponta para esse fluxo, nada acontece.

A conexão tem 3 passos obrigatórios:

1. **Publicar o fluxo** (não só salvar como rascunho)
2. **Selecionar o bot** no dropdown
3. **Bot precisa ter webhook ativo** (status "Online" em Gerenciar Bots)

---

## Passo 1 — Vincule o bot no editor

Abra o fluxo. Na topbar, clique no dropdown ao lado do nome do fluxo:

<!-- screenshot: dropdown "Selecionar bot" na topbar do editor -->

Escolha o bot que deve executar este fluxo.

> **Dica:** Você pode trocar o bot vinculado a qualquer momento. Mas tome cuidado: ao publicar com outro bot, o bot anterior perde esse fluxo (volta para a mensagem padrão de boas-vindas).

---

## Passo 2 — Publique

Clique no botão verde **"Publicar"** no canto superior direito.

3 coisas acontecem:

1. O fluxo passa de **Rascunho** → **Publicado**
2. Um **snapshot da versão** é criado (você pode voltar para esta versão depois — veja [Versionamento](./versionamento.md))
3. O bot é atualizado para usar **este fluxo** como gatilho de `/start`

---

## Passo 3 — Confirme que o bot está online

Volte ao painel → **Gerenciar Bots**.

O bot precisa estar com badge verde **"Online"**.

<!-- screenshot: card de bot com status Online -->

Se estiver **Offline**, clique em "Reconectar" no card. Sem isso, o Telegram não envia mensagens para o Umbra Bot.

---

## Cada bot tem apenas 1 fluxo "principal"

Cada bot tem um campo `active_flow_id` que aponta para **um único fluxo** (o que dispara no `/start`).

**Quando você publica:**
- Se o bot já tinha outro fluxo principal → ele é substituído pelo novo
- O fluxo anterior continua existindo como **Publicado**, mas não dispara mais para esse bot

---

## Quero usar vários fluxos no mesmo bot

Sim, dá. Use **palavra-chave** como gatilho dos outros fluxos:

| Fluxo | Gatilho | Dispara quando |
|---|---|---|
| Captura de leads | `/start` | Cliente novo aperta INICIAR |
| Apresentação produto A | palavra: `produto A`, `quero o A` | Cliente menciona produto A |
| Apresentação produto B | palavra: `produto B`, `quero o B` | Cliente menciona produto B |
| Suporte | palavra: `ajuda`, `problema`, `suporte` | Cliente pede ajuda |

Veja [Gatilhos e palavra-chave](./triggers-keyword.md) para o passo a passo.

---

## Como confirmar que está tudo conectado

Use esse checklist antes de divulgar o link do bot:

- [ ] Bot aparece como **Online** em Gerenciar Bots
- [ ] Fluxo está como **Publicado** na listagem
- [ ] No editor, o dropdown da topbar mostra um bot selecionado
- [ ] O fluxo tem pelo menos 1 nó com badge **▷ INÍCIO**
- [ ] Você usou **Modo de teste** ([guia](./modo-de-teste.md)) e o resultado foi o esperado
- [ ] Mandou `/start` no Telegram e a primeira mensagem chegou

Se todos OK, está conectado e pronto pra escalar.

---

## E se eu apagar o bot?

O Umbra Bot deixa o `active_flow_id` apontando para `null` automaticamente (via foreign key). O fluxo continua existindo mas perde o vínculo.

Você pode vincular outro bot e publicar de novo — funciona normal.

---

## Próximo passo

- [Modo de teste](./modo-de-teste.md) — simular antes de gastar com tráfego
- [Debugar fluxo](./debugar-fluxo.md) — quando algo não funciona
