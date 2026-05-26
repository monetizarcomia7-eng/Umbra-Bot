---
title: "O que é um fluxo de venda"
description: "Entenda o que são fluxos, quando usar e como eles automatizam suas conversas no Telegram."
order: 1
category: "Fluxos de venda"
---

# O que é um fluxo de venda

**TL;DR:** Um fluxo é uma sequência de mensagens que seu bot envia automaticamente conforme o cliente interage. Você desenha a conversa visualmente arrastando blocos (chamados "nós") e conectando-os. Quando alguém manda `/start` no seu bot, o fluxo dispara sozinho.

---

## Por que usar um fluxo

Sem fluxo, seu bot envia apenas a mensagem de boas-vindas e para. Cada cliente novo precisa ser atendido manualmente — o que não escala.

Com fluxo, você pode:

- **Capturar leads** automaticamente (nome, e-mail, telefone)
- **Apresentar produtos** com botões de compra
- **Aplicar etiquetas** no contato (ex: "interessado", "VIP")
- **Esperar tempo** entre mensagens (sem você fazer nada)
- **Tomar decisões** com base na resposta do cliente
- **Enviar mensagens de remarketing** automáticas (ex: "Vi que você não finalizou…")
- **Oferecer upsell, downsell e order bumps** depois da venda

Tudo isso acontece 24h/dia, sem você precisar estar online.

---

## Como um fluxo se parece

Imagine que você quer fazer uma conversa simples:

```
Bot: Olá! 👋 Que bom ter você aqui.
Bot: Qual é o seu nome?
Você: João
Bot: Prazer, João! Tenho uma oferta especial.
Bot: [botões: Quero comprar / Saber mais / Agora não]
```

No editor de fluxos, isso vira **4 blocos conectados** por linhas. Cada bloco é um nó (uma mensagem, uma pergunta, uma decisão).

<!-- screenshot: editor de fluxos com 4 nós conectados em sequência -->

---

## Quando usar um fluxo

**Use fluxo quando:**

- ✅ Você vende um infoproduto, mentoria, curso, e-book
- ✅ Quer qualificar leads antes de oferecer
- ✅ Tem um funil de vendas com etapas claras
- ✅ Atende muitos clientes e não consegue responder um por um
- ✅ Quer fazer upsell ou recuperar carrinho abandonado

**Não precisa de fluxo se:**

- ❌ Seu bot é só para suporte 1-a-1 manual
- ❌ Você quer apenas avisar quando alguém manda mensagem (use **Notificações**)

---

## Quanto custa um fluxo

**Zero.** Os fluxos fazem parte do plano do Umbra Bot. Você não paga por mensagem enviada, não paga por contato no fluxo, não paga por execução.

A única cobrança é a **taxa de R$ 1,00 por venda confirmada** via PIX — exatamente como no checkout.

---

## Quais limites existem

| Limite | Valor |
|---|---|
| Fluxos por conta | 500 |
| Nós por fluxo | 500 |
| Conexões por fluxo | 1.000 |
| Tamanho de um fluxo | 800 KB |
| Profundidade da execução | 20 nós em cadeia |
| Variáveis capturadas por contato | 64 KB no total |

Em prática, você vai criar fluxos com 5–30 nós. Os limites existem só para evitar abusos.

---

## Próximo passo

Pronto pra ver na prática? Vá para [Criar seu primeiro fluxo em 5 minutos](./criar-primeiro-fluxo.md).
