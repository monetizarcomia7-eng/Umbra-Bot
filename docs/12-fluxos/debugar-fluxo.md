---
title: "Debugar um fluxo que não funciona"
description: "Guia de troubleshooting: o que verificar quando o bot não responde, mensagens não chegam ou o fluxo trava."
order: 12
category: "Fluxos de venda"
---

# Debugar um fluxo que não funciona

**TL;DR:** Se o bot não responde, siga o checklist na ordem: (1) bot online, (2) fluxo publicado, (3) bot vinculado, (4) contato é novo, (5) modo de teste passou. 90% dos problemas estão nos 3 primeiros.

---

## Sintoma 1 — Bot não responde nada

### Verificar 1: o bot está online?

Vá em **Gerenciar Bots**. O bot precisa estar com badge verde **"Online"**.

<!-- screenshot: card do bot com status Online -->

**Se está Offline:**
1. Clique no card do bot
2. Clique no botão **"Reconectar"**
3. Aguarde alguns segundos
4. Status deve mudar para Online

**Por que isso acontece:**
- O webhook do Telegram pode cair (ex: token foi rotacionado)
- Cron de verificação (`check-bots`) detecta e marca como Offline a cada 8h

---

### Verificar 2: o token está correto?

Em **Gerenciar Bots** → clique no bot → aba **Geral** → "Revelar token".

Compare com o token que está no **BotFather** (`/mybots` no Telegram).

**Se forem diferentes:** edite no Umbra Bot, cole o token correto, salve e reconecte.

---

### Verificar 3: o fluxo está publicado?

Em **Fluxos de venda**, o card precisa ter badge verde **"Publicado"** (não "Rascunho").

<!-- screenshot: cards com status Publicado e Rascunho lado a lado -->

**Se está Rascunho:** abra no editor e clique em **🌐 Publicar** (não só "💾 Salvar").

---

### Verificar 4: o bot está vinculado ao fluxo?

Abra o fluxo no editor. Na topbar, o dropdown precisa mostrar um bot selecionado.

<!-- screenshot: dropdown da topbar com bot selecionado -->

**Se está "Selecionar bot":** escolha o bot e clique em **Publicar** de novo (não só salvar — é a publicação que ativa o vínculo).

---

### Verificar 5: o contato é novo?

`/start` **só dispara o fluxo para contatos novos**. Se você já tinha conversado com o bot antes, mandar `/start` de novo não reinicia o fluxo.

**Como testar:**
1. Vá em **Clientes**
2. Procure o seu contato (provavelmente seu próprio Telegram)
3. Clique no menu `...` → **Apagar**
4. Mande `/start` no bot novamente

> **Em produção:** clientes reais vão entrar pela primeira vez, então isso não é problema. É só uma chatice para testar.

---

## Sintoma 2 — Bot responde a primeira mensagem mas trava depois

### Causa comum: nó **delay**

O nó `delay` agora funciona de verdade (depois da migração 105). Ele:

1. Envia a mensagem do nó anterior
2. Agenda o próximo nó para daqui a N minutos/horas/dias
3. **Pausa o fluxo** até o tempo chegar
4. O cron `process-remarketing` roda a cada **1 hora** — então delays curtos podem demorar até 1h05 para retomar

**Solução:** se está testando, use delays de no mínimo 1 minuto e seja paciente — pode levar até 1h para o cron acordar.

---

### Causa comum: nó **pergunta** sem variável

Se o nó **Pergunta** tem o campo "variável" vazio, o fluxo pode travar (não sabe onde salvar a resposta).

**Solução:** abra cada nó Pergunta e confirme que tem nome de variável válido (só letras, números, underscore).

---

### Causa comum: nó **buttons** sem opções

Botões com lista de opções vazia não vão renderizar no Telegram → fluxo trava esperando clique que nunca vem.

**Solução:** abra cada nó Botões e adicione pelo menos 2 opções.

---

## Sintoma 3 — Variável aparece vazia na mensagem

Você escreveu `Olá {nome}` mas o cliente recebe `Olá `.

**Causa:** a variável não foi capturada antes.

Verifique:
- O nó **Pergunta** que captura `{nome}` vem **antes** do nó que usa?
- O nome da variável bate exatamente? (`nome` ≠ `Nome` ≠ `usuario`)
- Você está testando com cliente NOVO (variáveis ficam vazias se nunca foram capturadas)?

> **Truque:** use **Modo de teste** ([guia](./modo-de-teste.md)) — adicione `{nome}` no painel de variáveis com valor "Maria". Roda o teste e confirma se aparece corretamente.

---

## Sintoma 4 — Botão de URL não funciona

Cliente clica no botão **Link** ou **Checkout** mas nada acontece.

**Causa 1:** URL inválida (precisa começar com `https://` ou `http://`)

**Causa 2:** URL aponta para domínio privado (`localhost`, `10.x`, `192.168.x`) — o Umbra Bot bloqueia por segurança

**Como saber:**
- Tente publicar o fluxo. Se tem URL inválida, aparece banner vermelho com a lista de problemas
- No Inspector do nó, URLs inválidas mostram borda vermelha + ícone ⚠

---

## Sintoma 5 — Nó **condition** sempre vai pelo mesmo caminho

**Causa:** a variável usada na condição está vazia (não foi capturada antes).

**Como confirmar:**
- Abra o painel de **Análises** do fluxo
- Veja se o nó **Pergunta** que captura a variável tem `entered > 0` antes do `condition`

**Solução:** garanta a ordem correta dos nós no fluxo.

---

## Sintoma 6 — Imagem ou vídeo não aparece

**Causa 1:** URL retorna 404 (foto/vídeo foi apagado do servidor)

**Causa 2:** Arquivo grande demais (Telegram limita ~50 MB pra vídeo, ~10 MB pra foto)

**Causa 3:** Formato incorreto (use JPG/PNG para imagem, MP4 para vídeo)

**Como testar:** cole a URL no navegador. Se a imagem aparece, ela é válida.

---

## Como verificar tudo de uma vez

Use o **Dashboard de Análises** do fluxo:

1. Em **Fluxos de venda**, clique no menu `...` do fluxo → **Análises**
2. Veja o gráfico de eventos por dia
3. Veja o **Funil por nó** — onde os clientes estão parando?
4. Veja a aba **Nós com mais falhas** — se está vermelho, há erro real
5. Tabela detalhada mostra `entered`, `sent`, `failed`, `completed` por nó

<!-- screenshot: dashboard de análises mostrando funil + falhas -->

> **Se você publicou agora e a Análises está vazia:** a telemetria começa a aparecer assim que o primeiro cliente passar pelo fluxo. Aguarde alguns minutos depois do primeiro `/start`.

---

## Quando pedir ajuda

Se já fez todo o checklist e ainda não funciona, abra ticket no nosso suporte com:

- **Nome do fluxo** (ou ID)
- **Bot vinculado** (@username)
- **Qual passo travou** (primeira mensagem, terceiro nó, etc.)
- **Print do dashboard de Análises**
- **JSON exportado** ([como exportar](./exportar-importar.md)) — anexe para a gente reproduzir

---

## Próximo passo

- [Modo de teste](./modo-de-teste.md) — debugar antes de publicar
- [Versionamento](./versionamento.md) — voltar pra versão que funcionava
