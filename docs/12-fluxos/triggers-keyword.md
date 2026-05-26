---
title: "Gatilhos — quando o fluxo dispara"
description: "Diferença entre /start e palavra-chave. Como configurar múltiplos fluxos no mesmo bot."
order: 5
category: "Fluxos de venda"
---

# Gatilhos — quando o fluxo dispara

**TL;DR:** Por padrão, o fluxo dispara quando alguém manda `/start`. Você pode trocar para "palavra-chave" e o fluxo dispara quando o cliente digita certas palavras (ex: "promo", "preço").

---

## Os 2 tipos de gatilho

| Gatilho | Dispara quando |
|---|---|
| **`/start`** (padrão) | Cliente novo manda `/start` no bot |
| **Palavra-chave** | Cliente manda mensagem contendo uma das palavras configuradas |

---

## Gatilho `/start`

É o gatilho padrão. Você não precisa fazer nada.

**Como funciona:**
- Cliente abre o bot pela primeira vez no Telegram
- Cliente clica em "INICIAR" (Telegram já manda `/start` automaticamente)
- Seu fluxo `active_flow_id` do bot dispara

**Limitação:** Só dispara para **contatos novos** (nunca conversaram com o bot antes). Se a pessoa já mandou alguma mensagem alguma vez, `/start` não reinicia o fluxo.

> **Como testar de novo:** Vá em Clientes, apague o contato de teste, mande `/start` no Telegram. Agora ele dispara como se fosse novo.

---

## Gatilho de palavra-chave

Útil para **rodar fluxos diferentes** baseado no que o cliente digita.

**Exemplo:**
- Fluxo A — gatilho `/start` — fluxo de captura geral
- Fluxo B — gatilho palavra-chave: `promo`, `oferta`, `desconto` — apresenta a promoção
- Fluxo C — gatilho palavra-chave: `suporte`, `ajuda`, `problema` — abre atendimento

Quando o cliente manda "Vi que tem **promo** essa semana", o fluxo B dispara.

---

## Como configurar palavra-chave

1. No editor do fluxo, clique no ícone ⚙️ (Configurações) na topbar
2. Em **Gatilho de início**, escolha "Palavra-chave"
3. Digite as palavras uma por uma e pressione **Enter**
4. Salve e publique o fluxo

<!-- screenshot: modal de Configurações do fluxo com gatilho keyword + lista de palavras -->

---

## Como funciona o match de palavra-chave

O Umbra Bot:

1. Pega a mensagem do cliente (`"vi que tem promo essa semana"`)
2. Coloca tudo em minúsculas
3. Compara com **cada palavra-chave** do seu fluxo
4. Se **uma das palavras está contida** no texto, o fluxo dispara

Então `"promo"` casa com:
- ✅ `"promo"`
- ✅ `"vi que tem PROMO essa semana"`
- ✅ `"queria saber sobre promoções"` (contém "promo")
- ✅ `"PROMO!"`

Mas **NÃO** casa com:
- ❌ `"queria desconto"` (não contém "promo")
- ❌ `"prom"` (falta letra)

> **Dica:** Use palavras curtas e variações. Em vez de só "promoção", coloque "promo", "promocao", "oferta", "desconto".

---

## Múltiplos fluxos com palavras-chave

Você pode ter **vários fluxos** ativos no mesmo bot, cada um com suas palavras.

**Importante:** Se a mensagem do cliente bater com 2 fluxos diferentes, **o primeiro encontrado vence**. A ordem é a `updated_at` (último editado).

> **Recomendação:** Use palavras-chave bem específicas para cada fluxo, evitando sobreposição.

---

## Limitações

- Máximo de **50 palavras-chave por fluxo**
- Cada palavra com no máximo **64 caracteres**
- Comparação **não usa stemming nem fuzzy match** (`"promoçao"` sem til não vira `"promoção"`)

---

## E o que acontece com `/start` quando uso keyword?

Quando o gatilho é keyword:

- `/start` continua funcionando para mostrar a mensagem de boas-vindas do bot (configurada em Gerenciar Bots)
- Mas **esse fluxo não dispara no /start** — só na palavra-chave

Se quiser que o fluxo dispare **tanto** no `/start` quanto em palavras-chave, crie 2 fluxos: um com gatilho `/start` e outro com keyword.

---

## Próximo passo

- [Conectar o fluxo a um bot](./conectar-fluxo-bot.md) — como vincular o fluxo ao bot correto
- [Modo de teste](./modo-de-teste.md) — teste se sua palavra-chave bate antes de publicar
