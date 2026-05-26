---
title: "Variáveis — personalizar mensagens"
description: "Como usar {nome}, {email} e variáveis customizadas para mensagens personalizadas."
order: 4
category: "Fluxos de venda"
---

# Variáveis — personalizar mensagens

**TL;DR:** Escreva `{nome}` ou `{email}` no texto e o bot substitui pelo valor real que o cliente mandou. Você captura novas variáveis com o nó "Pergunta".

---

## Variáveis prontas

Estas você pode usar **em qualquer mensagem**, mesmo sem capturar nada antes:

| Variável | Substituída por |
|---|---|
| `{nome}` | Primeiro nome do contato (vem do Telegram) |
| `{email}` | E-mail (se já foi capturado) |
| `{bot}` | Nome do seu bot |
| `{data}` | Data de hoje (formato 26/05/2026) |

**Exemplo de mensagem:**

```
Olá, {nome}! 👋
Seja bem-vindo ao {bot}.
Hoje é {data}.
```

**Como o cliente recebe:**

```
Olá, João! 👋
Seja bem-vindo ao Meu Bot Pro.
Hoje é 26/05/2026.
```

---

## Variáveis customizadas

Você cria novas variáveis usando o nó **Pergunta**. Cada pergunta tem um campo "Salvar resposta em variável":

<!-- screenshot: inspector do nó Pergunta mostrando campo "variável" -->

**Exemplo:**

1. Nó **Pergunta** com texto "Qual sua idade?" e variável `idade`
2. Nó **Mensagem** depois com texto "Aos {idade} anos você tá começando do jeito certo!"

A variável `{idade}` é substituída pela resposta do cliente.

---

## Regras para nomes de variáveis

- ✅ Só letras (a-z, A-Z), números (0-9) e underscore (`_`)
- ❌ Sem acento (`endereço` não funciona, use `endereco`)
- ❌ Sem espaço (`primeiro nome` não funciona, use `primeiro_nome`)
- ❌ Sem caractere especial (`tel#1` não funciona)

O editor já valida isso pra você: tenta digitar caractere inválido e o campo bloqueia.

---

## Variáveis vazias

Se a variável não foi capturada ainda, ela vira **vazia** na mensagem.

Exemplo: você usa `{idade}` mas nunca perguntou a idade do cliente. A mensagem fica com um buraco:

```
Você disse que tem  anos. ← campo vazio
```

> **Dica:** Sempre capture a variável **antes** de usar. Use o **Modo de teste** ([guia aqui](./modo-de-teste.md)) para ver como a mensagem fica.

---

## Quais variáveis ficam salvas

Tudo que você captura via nó "Pergunta" fica salvo no contato (na tabela `contacts.flow_vars` do banco). Isso significa:

- ✅ As variáveis sobrevivem ao fim do fluxo
- ✅ Você consegue ver no painel de Clientes (aba **Anotações** mostra `flow_vars`)
- ✅ Outros fluxos do **mesmo bot** podem usar essas variáveis

---

## Casos de uso comuns

### Personalização básica
```
Mensagem: "Oi {nome}! Bom te ver de novo. 😊"
```

### Captura + uso na mesma conversa
```
Pergunta: "Qual o seu maior desafio hoje?" (var: desafio)
Mensagem: "Entendi — '{desafio}' é algo que muita gente enfrenta."
```

### Segmentação dinâmica
```
Pergunta: "Qual seu nicho?" (var: nicho)
Condição: Se {nicho} contém "fitness" → vai para oferta A
                                  senão → vai para oferta B
```

### Captura para CRM
```
Pergunta: "Qual seu Instagram?" (var: insta)
→ A variável fica salva e você pode exportar via CSV em "Clientes"
```

---

## E se eu apagar um nó Pergunta?

A variável continua existindo no contato (não é removida do banco). Mas novos contatos que entrarem no fluxo não terão essa variável capturada.

---

## Próximo passo

- [Tipos de nós](./tipos-de-nos.md) — outras formas de usar variáveis (Condição, Oferta com `{produto}`)
- [Modo de teste](./modo-de-teste.md) — simule diferentes valores de variável antes de publicar
