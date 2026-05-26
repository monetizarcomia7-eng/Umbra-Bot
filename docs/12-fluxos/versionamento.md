---
title: "Versionamento e rollback"
description: "Cada publicação cria uma versão imutável. Você pode voltar para versões anteriores a qualquer momento."
order: 9
category: "Fluxos de venda"
---

# Versionamento e rollback

**TL;DR:** Toda vez que você clica "Publicar", o Umbra Bot guarda uma cópia (versão) do fluxo. Se algo der errado depois, você volta para qualquer versão anterior em 2 cliques — sem perder histórico.

---

## Como funciona

```
v1 — você publicou no dia 10
v2 — você editou + publicou no dia 12
v3 — você editou de novo + publicou no dia 15 (atual)
```

Cada versão é uma **fotografia imutável** dos nós e arestas no momento do clique em "Publicar".

> **Por que isso importa:** se você edita um fluxo e quebra alguma coisa (ex: removeu um nó importante), você consegue voltar pra versão que funcionava — sem reconstruir nada.

---

## Quem usa qual versão

| Quem | Versão usada |
|---|---|
| Novos clientes que iniciam `/start` | **Última versão publicada** |
| Clientes que já estão executando o fluxo | A versão que estava ativa quando eles entraram (snapshot) |

> Esse comportamento é **muito importante**. Você pode editar um fluxo enquanto 100 clientes estão executando ele — eles **continuam na versão antiga** até terminarem. Não quebra ninguém no meio do caminho.

---

## Ver o histórico

No editor do fluxo, clique no ícone 📋 **Histórico** na topbar.

<!-- screenshot: ícone de histórico destacado na topbar do editor -->

Uma janela abre com a lista de versões:

```
v3 [ATUAL]          15 de maio · 14:32
v2                  12 de maio · 09:15        [Restaurar]
v1                  10 de maio · 18:00        [Restaurar]
```

A versão atual fica destacada em verde. As outras têm botão "Restaurar".

---

## Restaurar uma versão

1. Clique em **Restaurar** na versão desejada
2. Aparece **Confirmar** vermelho — clique para confirmar
3. O fluxo **atual é sobrescrito** com a versão escolhida
4. Você é levado de volta para a lista

> **Atenção:** Restaurar **sobrescreve** o rascunho atual. Se você tinha mudanças não salvas, elas se perdem.

Para "publicar" essa versão restaurada como nova v4, clique em **Publicar** depois (a versão é restaurada como rascunho).

---

## Limites do histórico

- Máximo de **50 versões por fluxo** (versões mais antigas são removidas automaticamente)
- Versões ficam armazenadas no banco mesmo se você apagar o fluxo — então não deletam por engano

---

## Quando restaurar

✅ Use restaurar quando:
- Acabou de editar e o bot começou a dar erro
- Quer comparar performance: "v2 vendia mais que v3"
- Time editou e você não gostou da nova versão
- Houve teste de A/B e você quer voltar pro vencedor

❌ Não use quando:
- Quer só ver as mudanças entre versões (recurso de "diff" ainda não existe)
- Quer rebobinar parcialmente (não dá pra "restaurar só esse nó")

---

## Histórico vs Undo/Redo

| | Undo/Redo (Ctrl+Z) | Histórico de versões |
|---|---|---|
| Onde fica | No editor, durante a sessão | No banco, para sempre |
| Limite | 50 estados | 50 versões publicadas |
| Granularidade | Cada mudancinha | Só ao publicar |
| Sobrevive a refresh? | Não | Sim |

Pense assim:
- **Undo/Redo** = corretor enquanto você escreve
- **Histórico** = checkpoints que você salvou propositalmente

---

## Como exportar uma versão antiga

Hoje, o **Importar/Exportar JSON** ([guia](./exportar-importar.md)) só funciona com a versão **atual** do fluxo.

Para exportar uma versão antiga:
1. Restaure a versão (vira o rascunho atual)
2. Exporte o JSON
3. Restaure de volta para a versão mais recente
4. Importe o JSON exportado quando quiser

---

## E quando edito um fluxo publicado?

Você **edita o rascunho** — não interfere na versão publicada. Os clientes em execução continuam vendo a versão antiga.

Quando você clicar **Publicar** de novo:
- Uma nova versão (vN+1) é criada
- Novos `/start` passam a usar vN+1
- Clientes em meio de execução continuam na versão antiga

---

## Próximo passo

- [Exportar e importar fluxo (JSON)](./exportar-importar.md) — backup manual
- [Debugar fluxo](./debugar-fluxo.md) — antes de restaurar, veja o que está dando errado
