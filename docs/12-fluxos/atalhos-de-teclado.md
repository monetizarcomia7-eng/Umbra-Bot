---
title: "Atalhos do editor"
description: "Todos os atalhos de teclado para acelerar a edição de fluxos."
order: 10
category: "Fluxos de venda"
---

# Atalhos do editor

**TL;DR:** Pressione `?` no editor para abrir a lista completa de atalhos. Os mais usados são `D` (duplicar), `Ctrl+C/V` (copiar/colar), `Shift+N` (nova mensagem) e `Del` (apagar).

---

## Edição

| Tecla | Ação |
|---|---|
| **`Shift+N`** | Adiciona um nó **Mensagem** no centro do canvas |
| **`D`** | Duplica o nó (ou nós) selecionados |
| **`Ctrl+C`** / `Cmd+C` | Copia os nós selecionados para o clipboard interno |
| **`Ctrl+V`** / `Cmd+V` | Cola os nós do clipboard no centro do canvas |
| **`Ctrl+Z`** / `Cmd+Z` | Desfazer |
| **`Ctrl+Y`** / `Ctrl+Shift+Z` | Refazer |
| **`Del`** / `Backspace` | Apaga os nós selecionados (ou a aresta selecionada) |

> **Nota:** O clipboard é **interno** ao Umbra Bot. Os nós copiados só colam no mesmo navegador/aba — não vai para o clipboard do sistema.

---

## Seleção

| Tecla | Ação |
|---|---|
| **Click** num nó | Seleciona apenas aquele nó |
| **Shift+Click** | Adiciona o nó à seleção (ou remove se já estava) |
| **Shift+Arrastar** no fundo | Box-select: seleciona todos os nós dentro da área |
| **Esc** | Limpa toda a seleção e qualquer conexão em progresso |

---

## Canvas

| Tecla | Ação |
|---|---|
| **Arrastar** o fundo | Move o canvas (pan) |
| **Scroll do mouse** | Zoom in/out (no ponto onde está o cursor) |
| **Arrastar do handle** de saída para a entrada de outro nó | Conecta dois nós |

---

## Modais e painéis

| Tecla | Ação |
|---|---|
| **`?`** | Abre a lista completa de atalhos |

> O atalho `?` só funciona quando você **não tem nenhum input/textarea focado**. Se nada acontece, clique numa área vazia do canvas primeiro.

---

## Atalhos via interface (não teclado)

| Botão | Ação |
|---|---|
| ⏪ **Voltar** | Volta para a lista de fluxos (pergunta se há mudanças não salvas) |
| **Organizar** | Auto-layout via algoritmo dagre (alinha nós em árvore vertical) |
| **↶ Desfazer** / **↷ Refazer** | Mesmo que Ctrl+Z / Ctrl+Y |
| **⚙ Configurações** | Modal com descrição, gatilho e palavras-chave |
| **▶ Testar** | Abre o [Modo de teste](./modo-de-teste.md) |
| **📋 Histórico** | Lista de [versões publicadas](./versionamento.md) |
| **📊 Análises** | Vai para o dashboard de telemetria do fluxo |
| **📄 Importar/Exportar** | [Backup e import JSON](./exportar-importar.md) |
| **⌨ Atalhos** | Mesmo que `?` |
| **💾 Salvar** | Salva como rascunho (não publica) |
| **🌐 Publicar** | Salva + cria versão + ativa no bot |

---

## Atalhos no inspector (painel direito)

Quando você seleciona **1 nó**, o painel direito vira o **Inspector**.

| Botão | Ação |
|---|---|
| 📋 **Duplicar** (canto sup. direito) | Mesmo que `D` |
| 🗑️ **Apagar** (vermelho) | Mesmo que `Del` |

---

## Dica de produtividade

A combinação mais útil no dia a dia:

1. **Shift+N** — cria nova mensagem
2. **Arrastar do handle** de saída do nó anterior até a entrada do novo
3. Clica no novo nó → digita o texto no Inspector
4. **D** quando precisar duplicar
5. **Ctrl+Z** se errar
6. **Salvar** ou **Publicar** quando terminar

Em 30 segundos você adiciona uma nova mensagem ao final do fluxo.

---

## Próximo passo

- [Tipos de nós](./tipos-de-nos.md) — referência de todos os blocos
- [Modo de teste](./modo-de-teste.md) — atalho `▶ Testar`
