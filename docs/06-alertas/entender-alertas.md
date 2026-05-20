---
title: "Entender os alertas"
description: "O que são alertas, quais tipos existem e como o sistema de alertas te mantém informado sobre o que importa."
order: 1
category: "Alertas"
---

# Entender os alertas

**TL;DR:** Alertas são avisos automáticos sobre eventos importantes — bot desconectado, nova venda, problema de integração. Eles ficam na aba Alertas e você também pode receber por e-mail ou Telegram.

---

## Como acessar

No menu lateral, clique em **"Alertas"**. Um badge vermelho no ícone da sidebar aparece quando há alertas não resolvidos.

<!-- screenshot: ícone de Alertas no menu lateral com badge numérico -->

---

## Para que servem os alertas

O Umbra Bot gera alertas automaticamente para que você não precise ficar verificando o painel o tempo todo. Se algo importante acontecer — um bot cair, uma venda alta chegar, uma integração falhar — um alerta aparece.

---

## Tipos de alerta

### Crítico (vermelho)

Requer atenção imediata. Exemplos:
- **Bot desconectado** — um dos seus bots perdeu a conexão com o Telegram
- **Gateway com falha** — o Mercado Pago ou outra integração está com problema

### Aviso (amarelo)

Algo merece atenção, mas não é urgente. Exemplos:
- Limite do plano próximo de ser atingido
- Webhook com erros intermitentes

### Informativo (azul)

Novidades relevantes que não exigem ação. Exemplos:
- **Nova venda** — uma transação foi aprovada com valor acima de um limiar
- Novo afiliado cadastrado

<!-- screenshot: lista de alertas com os três tipos visíveis -->

---

## O que cada alerta mostra

Cada alerta na lista exibe:
- **Ícone e cor** indicando a severidade
- **Título** descritivo do que aconteceu
- **Descrição** com mais detalhes
- **Tempo** de quando foi gerado
- **Status** — ativo ou resolvido
- **Botão de ação** — quando aplicável, leva direto para a área do problema

---

## Alertas automáticos de bots

O sistema verifica seus bots a cada 30 minutos. Se detectar que um bot está offline, cria automaticamente um alerta crítico. Quando o bot voltar ao ar, o alerta é marcado como resolvido pelo próprio sistema — você não precisa fazer nada.

---

## Filtrar alertas

Use os filtros no topo da página para ver:
- **Severidade:** Crítico / Aviso / Informativo
- **Status:** Ativos / Resolvidos
- **Tipo:** Bot / Gateway / Venda / Integração / etc.

<!-- screenshot: filtros de alerta com opções de severidade e status -->

---

## Próximo passo

👉 [Resolver e gerenciar alertas](./resolver-alertas.md)
