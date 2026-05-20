---
title: "Exportar histórico de atividade"
description: "Como baixar o histórico de atividade em planilha CSV para análise externa ou arquivamento."
order: 3
category: "Atividade"
---

# Exportar histórico de atividade

**TL;DR:** Aplique os filtros que quiser e clique em "Exportar CSV". O arquivo baixa com todos os eventos visíveis na tela — útil para relatórios e arquivamento.

---

## Por que exportar

O histórico dentro do Umbra Bot é mantido por 90 dias. Se você precisa de um registro permanente, a exportação em CSV é a forma de guardar os dados antes que sejam removidos.

Também é útil para:
- Criar relatórios personalizados em Excel ou Google Sheets
- Apresentar dados para sócios ou clientes
- Cruzar com dados de outras plataformas

---

## Como exportar

**1.** Na tela de **Atividade**, aplique os filtros que quiser (categoria, bot, período, busca)

**2.** Clique em **"Exportar CSV"** no canto superior direito

<!-- screenshot: botão "Exportar CSV" na tela de Atividade -->

**3.** O arquivo é baixado automaticamente com o nome no formato `atividade_AAAA-MM-DD.csv`

---

## O que vem no arquivo

O CSV exportado contém as seguintes colunas:

| Coluna | Exemplo |
|---|---|
| Data | 2026-05-20 14:35:00 |
| Tipo | lead |
| Título | Novo lead |
| Descrição | João Silva iniciou conversa |
| Bot | @meubot |
| Valor (R$) | 0,00 |

---

## Dica: exportar por período

Se quiser um relatório mensal, aplique o filtro de **Período → 30 dias** antes de exportar. O arquivo vai conter apenas os eventos do último mês.

Para períodos específicos (ex: só o mês de março), você pode exportar e depois filtrar nas datas diretamente no Excel ou Google Sheets.
