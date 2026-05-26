---
title: "Modo de teste — simular antes de publicar"
description: "Como simular a conversa do bot sem enviar nada ao Telegram. Útil para testar variações."
order: 8
category: "Fluxos de venda"
---

# Modo de teste

**TL;DR:** Botão "Testar" no editor abre um simulador. Você vê toda a conversa como se fosse um cliente, sem mandar nada para o Telegram. Pode mudar variáveis e escolher qual botão simular.

---

## Por que testar antes

Publicar e mandar `/start` no seu próprio bot funciona — mas tem problemas:

- ❌ Telegram limita 1 conversa ativa por contato (já testei → preciso apagar o contato e mandar de novo)
- ❌ Não dá pra simular "e se o cliente clicasse no botão 2 em vez do 1?"
- ❌ Não dá pra simular variáveis customizadas (`{idade}`, `{nicho}`)
- ❌ Se você esquecer de configurar URL/imagem, descobre tarde

O modo de teste resolve tudo isso **sem enviar mensagem real**.

---

## Como abrir

No editor de fluxos, clique no botão **▶ Testar** na topbar.

<!-- screenshot: botão Testar destacado na topbar do editor -->

Uma janela grande abre com 2 painéis:

- **Esquerda:** configurações (variáveis, botões, keyword)
- **Direita:** o trail da conversa simulada

---

## Painel esquerdo — Variáveis

Aqui você define os valores das variáveis **como se o cliente já tivesse respondido**.

Vem com 2 variáveis prontas:
- `{nome}`: "João Silva"
- `{email}`: "joao@exemplo.com"

<!-- screenshot: painel de variáveis com os 2 inputs já preenchidos -->

**Para adicionar:** preencha "Nome" + "Valor" embaixo e clique **+ Adicionar**.

**Para editar:** clique direto no campo do valor.

**Para remover:** passe o mouse na linha → aparece um `×` à direita.

> **Dica:** Se seu fluxo usa `{idade}` ou `{produto}`, adicione essas variáveis aqui antes de testar. Senão elas vão aparecer **vazias** na conversa simulada.

---

## Painel esquerdo — Botões a simular

Se seu fluxo tem nós **Botões**, eles aparecem listados aqui.

Para cada nó, escolha qual opção deve ser "clicada" pelo cliente simulado.

<!-- screenshot: dropdown de escolha de botão para cada nó -->

Padrão: sempre o primeiro botão.

> **Exemplo:** seu nó pergunta "O que deseja?" com 3 opções (Comprar / Saber mais / Agora não). No primeiro teste, simule "Comprar". Re-execute e simule "Agora não" para ver o outro caminho.

---

## Painel esquerdo — Testar palavra-chave

Aparece **apenas** se seu fluxo está configurado com **trigger keyword**.

Digite uma mensagem que o cliente mandaria. O sistema testa se ela bateria com alguma das suas palavras-chave.

<!-- screenshot: campo de teste de keyword com resultado verde "bateu com 'promo'" -->

**Resultado verde** = a mensagem dispararia o fluxo
**Resultado vermelho** = a mensagem **não** dispararia o fluxo

Útil para validar palavras curtas demais (que disparariam falsos positivos) ou específicas demais (que nunca bateriam).

---

## Painel direito — Trail da conversa

Mostra a conversa do jeito que ela aconteceria:

- **Cinza claro** (esquerda): bot
- **Roxo** (direita): resposta simulada do usuário
- **Cinza médio** (centro): eventos do sistema (`→ Simulando clique em "Comprar"`, `⏱ Aguardar 1h (em modo de teste: instantâneo)`)

<!-- screenshot: trail da conversa com mensagens do bot, usuário e eventos -->

---

## O que o teste NÃO faz

- ❌ Não envia mensagem real para o Telegram
- ❌ Não cria contato no banco
- ❌ Não dispara eventos de telemetria (`flow_node_events`)
- ❌ Não respeita delays reais (todo delay é instantâneo no teste)
- ❌ Não testa URL real (URLs em nós Link/Checkout aparecem mas não abrem)

É **simulação pura** — só pra você ver o roteiro da conversa.

---

## Re-executar

Mudou alguma coisa (variável, escolha de botão)? Clique em **Re-executar** no topo do modal.

A simulação roda do zero e o trail é atualizado.

---

## Quando NÃO usar o modo de teste

- 🔴 Validar se webhook do Telegram está ativo → mande `/start` no bot mesmo
- 🔴 Validar se URL de imagem/vídeo funciona → abra a URL no navegador
- 🔴 Validar se cron de delay está rodando → use [Análises](./debugar-fluxo.md) depois

Pra essas 3 coisas, teste de verdade.

---

## Workflow recomendado

1. Crie o fluxo (use um template para ganhar tempo)
2. **Teste no Modo de teste** — corrige textos, ordem de nós, variáveis
3. Quando o roteiro estiver bom → **Publique**
4. Mande `/start` no bot e confirme que o webhook real responde
5. Acompanhe a Análises por alguns dias

---

## Próximo passo

- [Debugar fluxo](./debugar-fluxo.md) — quando o teste passa mas a real não funciona
- [Versionamento](./versionamento.md) — voltar para uma versão anterior se algo quebrar
