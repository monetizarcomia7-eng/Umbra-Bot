---
title: "Importar clientes por planilha"
description: "Como importar uma lista de contatos em massa usando um arquivo CSV."
order: 4
category: "Clientes"
---

# Importar clientes por planilha

**TL;DR:** Prepare uma planilha com os dados dos clientes, salve como CSV, arraste para o Umbra Bot e confirme. Funciona para listas de qualquer tamanho.

---

## Quando usar

Use a importação por planilha quando você tem uma lista pronta — de outro sistema, de uma planilha do Excel ou Google Sheets, de uma ferramenta de e-mail marketing, etc.

Para adicionar um único cliente, use [Adicionar cliente manualmente](./adicionar-cliente-manual.md).

---

## Formato da planilha

A planilha precisa ter os dados nas colunas nesta ordem:

| Coluna | Obrigatório | Exemplo |
|---|---|---|
| Nome | **Sim** | Maria Silva |
| @Usuário do Telegram | Não | mariasilva (sem o @) |
| E-mail | Não | maria@email.com |
| Telefone | Não | 11999999999 |
| Origem | Não | instagram |
| Tags | Não | vip;lista-espera |

> **Dica para múltiplas tags:** Separe as tags com ponto e vírgula dentro da mesma célula. Ex: `vip;compradora;evento-2025`

---

## Preparar o arquivo

### No Google Sheets

1. Organize os dados nas colunas na ordem acima
2. Clique em **Arquivo → Fazer download → Valores separados por vírgula (.csv)**

### No Excel

1. Organize os dados nas colunas na ordem acima
2. Clique em **Arquivo → Salvar como**
3. Em "Tipo", escolha **CSV UTF-8 (delimitado por vírgulas)**

> **Importante:** Salve como CSV, não como .xlsx. O sistema só aceita o formato CSV.

---

## Passo a passo da importação

### Passo 1 — Abra o modal

Na tela de **Clientes**, clique em **"Importar CSV"**.

<!-- screenshot: botão "Importar CSV" na tela de Clientes -->

### Passo 2 — Selecione o arquivo

Clique em **"Selecionar arquivo"** ou arraste o arquivo CSV direto para a área indicada.

<!-- screenshot: área de upload com instrução para arrastar o arquivo -->

### Passo 3 — Confirme o preview

O sistema vai mostrar uma prévia com as primeiras linhas do arquivo. Verifique se os dados apareceram corretamente nas colunas certas.

Se algo estiver errado (dados nas colunas trocadas, caracteres estranhos), corrija o arquivo e faça upload novamente.

<!-- screenshot: preview das primeiras linhas após fazer upload do CSV -->

### Passo 4 — Importe

Clique em **"Importar"**. O sistema vai processar o arquivo e adicionar os contatos em lotes.

Ao finalizar, uma mensagem mostra quantos contatos foram importados com sucesso.

---

## Perguntas comuns

**E se já tiver um contato com o mesmo e-mail ou @usuário?**
O sistema não cria duplicatas — se o contato já existe, ele é ignorado na importação.

**O arquivo tem 5.000 linhas — vai funcionar?**
Sim. O sistema processa arquivos grandes em lotes menores para não travar.

**Posso importar uma lista sem e-mail?**
Sim. Só o campo "Nome" é obrigatório. Os demais campos ficam em branco se não forem preenchidos.

**Os contatos importados aparecem como leads ou compradores?**
Todos começam como **Lead**. O status muda para Comprador automaticamente quando uma compra é aprovada.
