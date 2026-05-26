---
title: "Exportar e importar fluxo (JSON)"
description: "Como fazer backup do seu fluxo ou transferir entre contas usando arquivos JSON."
order: 11
category: "Fluxos de venda"
---

# Exportar e importar fluxo (JSON)

**TL;DR:** Botão **📄 Import/Export** na topbar abre um modal. Aba "Exportar" copia ou baixa o JSON do fluxo atual. Aba "Importar" cola/upload de JSON para substituir o fluxo atual.

---

## Por que exportar

- 💾 **Backup** — guardar uma cópia fora do Umbra Bot
- 🔁 **Reaproveitar** — usar a mesma estrutura em outra conta
- 👥 **Compartilhar** — enviar para um sócio ou cliente
- 🧪 **Sandbox** — testar mudanças sem afetar a versão real

---

## Como exportar

1. Abra o fluxo no editor
2. Clique no ícone 📄 (Import/Export) na topbar
3. A aba **Exportar** já vem selecionada

<!-- screenshot: modal Import/Export aberto na aba Exportar -->

Você tem 2 opções:

### Copiar JSON
Botão **📋 Copiar JSON** — copia o conteúdo para a área de transferência. Cole em qualquer lugar (email, Notion, doc).

### Baixar arquivo
Botão **⬇ Baixar arquivo** — salva um `.json` no seu computador. Nome padrão: `nome-do-fluxo-2026-05-26.json`.

---

## O que vai no arquivo exportado

```json
{
  "format": "umbra-flow",
  "version": 1,
  "name": "Captura de leads",
  "description": "Coleta nome + e-mail",
  "triggerType": "start",
  "keywords": [],
  "nodes": [...],
  "edges": [...],
  "exportedAt": "2026-05-26T14:32:00.000Z"
}
```

**Inclui:**
- ✅ Estrutura completa de nós e conexões
- ✅ Textos das mensagens
- ✅ Configurações (descrição, gatilho, palavras-chave)
- ✅ Data da exportação

**NÃO inclui:**
- ❌ Estatísticas (executions, conversion)
- ❌ Histórico de versões
- ❌ Telemetria
- ❌ Bot vinculado (você re-vincula ao importar)

---

## Como importar

1. No editor de um fluxo (pode ser um novo, em branco), clique em 📄 Import/Export
2. Clique na aba **Importar**

<!-- screenshot: aba Importar com input de arquivo e textarea -->

Você tem 2 formas:

### Upload de arquivo
Clique em "Escolher arquivo" e selecione um `.json` exportado antes. O conteúdo aparece na textarea.

### Colar JSON
Cole direto na textarea. Útil quando alguém te mandou o JSON por mensagem.

3. Clique em **Importar e substituir**

> ⚠️ **Atenção:** Importar **substitui** todos os nós e arestas do fluxo atual. Se você tinha algo aí, será perdido. Use **Ctrl+Z** para desfazer se for acidente.

---

## O que acontece tecnicamente ao importar

1. O JSON é validado (deve ter `format: "umbra-flow"`)
2. Limites são checados: máximo 500 nós, 1.000 arestas
3. **IDs são reescritos** automaticamente — `n1` vira `n-abc12345`, etc. Isso evita colisão com nós existentes (se você importar 2 vezes seguidas).
4. As conexões (arestas) são atualizadas para apontar para os novos IDs
5. **Tipos de nó desconhecidos são ignorados** (você recebe um aviso) — protege contra JSON malicioso ou desatualizado

---

## Importar de uma versão futura

Se você exportou de uma versão mais nova do Umbra Bot e importou numa mais antiga, tipos de nó **que não existem ainda** são descartados. Você recebe aviso: "Ignorados tipos desconhecidos: ...".

O fluxo importa parcialmente — provavelmente com conexões quebradas. Recomendação: atualize sua conta antes.

---

## Casos de uso

### Backup mensal
Toda semana/mês, exporte os fluxos importantes e guarde num drive. Se algo der errado depois (você apagou sem querer, o banco teve problema raro), você reconstrói em 1 minuto.

### Migrar de conta
- Exportar JSON na conta antiga
- Logar na conta nova
- Criar fluxo em branco
- Importar JSON
- Vincular ao bot da conta nova
- Publicar

### Templates pessoais
Tem 3 estruturas que você usa em todos os clientes? Exporte cada uma como JSON e guarde num "kit". Para criar um novo cliente, é só importar.

### Compartilhar com sócio
Mande o JSON pelo Telegram/Slack. Ele importa numa conta dele e tem o mesmo fluxo.

---

## Limites de tamanho

- Arquivo JSON deve ter no máximo **~800 KB**
- Conta com isso na hora de copiar nodes muito grandes (com base64 de imagem inline, por exemplo)

Para imagens, use **URLs HTTPS públicas** — não tente colocar a imagem inline no JSON.

---

## Próximo passo

- [Versionamento](./versionamento.md) — alternativa ao backup manual (automático ao publicar)
- [Templates](./templates.md) — quando você quer reaproveitar mas não precisa de backup
