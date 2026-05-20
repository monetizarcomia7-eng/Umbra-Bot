---
title: "Adicionar cliente manualmente"
description: "Como cadastrar um cliente diretamente no painel, sem precisar que ele passe pelo bot."
order: 3
category: "Clientes"
---

# Adicionar cliente manualmente

**TL;DR:** Clique em "+ Adicionar cliente", preencha os dados e salve. Útil para migrar uma lista existente ou cadastrar alguém que você atendeu por outro canal.

---

## Quando usar

- Você tem uma lista de clientes de outro sistema e quer centralizar tudo no Umbra Bot
- Um cliente entrou em contato por e-mail ou WhatsApp e você quer registrá-lo
- Você importa participantes de um evento ou curso

Para listas grandes, prefira a [importação por planilha CSV](./importar-clientes-csv.md) — é mais rápido.

---

## Passo 1 — Abra o modal

Na tela de **Clientes**, clique em **"+ Adicionar cliente"** no canto superior direito.

<!-- screenshot: botão "+ Adicionar cliente" destacado -->

---

## Passo 2 — Preencha os dados

| Campo | Obrigatório | O que é |
|---|---|---|
| **Nome** | Sim | Nome completo do cliente |
| **@Usuário do Telegram** | Não | O @username no Telegram (sem o @) |
| **E-mail** | Não | E-mail de contato |
| **Telefone** | Não | Número com DDD |
| **Origem** | Não | De onde veio (ex: whatsapp, evento, indicação) |
| **Tags** | Não | Etiquetas separadas por ponto e vírgula |

<!-- screenshot: formulário de novo cliente com campos preenchidos -->

---

## Passo 3 — Salve

Clique em **"Salvar"**. O cliente aparece imediatamente na lista com o status **"Lead"**.

O status muda para **"Comprador"** automaticamente quando uma compra for aprovada para esse cliente.

---

## Próximo passo

👉 [Importar lista de clientes por planilha](./importar-clientes-csv.md)
