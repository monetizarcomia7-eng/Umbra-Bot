---
title: "Tipos de nós — o que cada bloco faz"
description: "Guia completo dos 17 tipos de nós disponíveis no editor de fluxos."
order: 3
category: "Fluxos de venda"
---

# Tipos de nós

**TL;DR:** Cada nó faz uma coisa: enviar mensagem, perguntar, esperar tempo, vender, aplicar tag. Esta página é o seu manual de referência — consulte sempre que tiver dúvida sobre o que um nó faz.

---

## 💬 Conversa

### Mensagem
Envia um texto simples. Avança automaticamente para o próximo nó.

> Use para: dar boas-vindas, explicar algo, agradecer.

### Pergunta
Envia uma pergunta e **pausa o fluxo** aguardando a resposta do cliente. A resposta fica salva numa variável (você define o nome, ex: `nome`, `email`).

> Use para: capturar nome, e-mail, idade, qualquer informação aberta.

### Botões
Envia uma mensagem com **até 6 botões clicáveis**. Cada botão tem sua própria saída (vai para um nó diferente). O fluxo pausa esperando o clique.

> Use para: dar opções rápidas ("Sim/Não/Talvez"), segmentar interesse.

### Telefone
Como a Pergunta, mas otimizada para capturar número de telefone. A resposta vai automaticamente para o campo `phone` do contato.

> Use para: pedir WhatsApp ou telefone de contato.

---

## ⚙️ Lógica

### Condição
Bifurca o fluxo em **Sim** ou **Não** com base em uma variável que você capturou antes. Operadores disponíveis:

- `é igual a`
- `é diferente de`
- `contém`
- `começa com`
- `termina com`
- `não está vazio`
- `está vazio`
- `maior que` (números)
- `menor que` (números)

> Use para: "Se `{idade}` maior que 18, mostrar oferta adulta; senão, oferecer outro produto."

### Espera (Delay)
Pausa o fluxo por **N minutos, horas ou dias**. Depois retoma sozinho do próximo nó.

> Use para: "Espera 1 hora e manda mensagem perguntando se ainda tem dúvida."

> **Importante:** O delay é processado por um cron a cada 1 hora. Então um delay de 5 minutos pode levar até 1h05 para retomar. Use minutos só quando for >15 minutos.

---

## 💰 Comercial

### Oferta
Envia uma mensagem formatada com nome do produto, preço e botão de compra.

> Use para: apresentar seu produto principal.

### Checkout
Envia um botão inline que abre direto a página de checkout. Comprador é redirecionado fora do Telegram.

> Use para: link de pagamento PIX gerado por você.

### Upsell
Oferta de **produto mais caro** após uma venda. Tem campos: produto, preço com desconto, descrição, CTA, URL.

> Use para: "Já que você comprou o curso básico, que tal o Premium?"

### Downsell
Oferta **mais barata** quando o cliente recusa a principal.

> Use para: "Tudo bem, tenho uma opção menor por R$ X."

### Order Bump
Produto **complementar** que o cliente adiciona à compra principal.

> Use para: "Aproveite e leve também esse bônus por +R$ 47."

---

## 🎬 Mídia

### Imagem
Envia uma foto com legenda opcional. A URL precisa ser HTTPS pública.

> Use para: print do produto, infográfico, depoimento em imagem.

### Vídeo
Envia um vídeo (MP4 público). Tem o mesmo limite do Telegram (até 50 MB).

> Use para: VSL curta, depoimento, demo do produto.

### Link
Envia um botão inline que abre uma URL externa.

> Use para: link para site, formulário, página de captura.

---

## 🏷 CRM

### Aplicar tag
Adiciona ou remove uma tag do contato (ex: "interessado", "VIP", "lead-frio").

> Use para: segmentar a base para campanhas futuras.

### Humano (handoff)
Marca o fluxo como **terminado** e o contato como "aguardando atendimento humano".

> **Atenção:** O sistema real de atendimento humano ainda não foi implementado. Este nó hoje só encerra o fluxo. Use o nó "Mensagem" se quiser só avisar "alguém vai te atender".

### Remarketing
Agenda uma mensagem para ser enviada **depois de N tempo**. Diferente do delay: o fluxo continua executando os próximos nós **agora**, e a mensagem é enviada lá na frente em background.

> Use para: "Mandar mensagem 24h depois mesmo se cliente não responder mais."

---

## Visualização no editor

Cada nó aparece com:

- **Cor da categoria** (azul = conversa, verde = comercial, etc.)
- **Ícone** identificando o tipo
- **Preview do conteúdo** (primeira linha do texto)
- **Mini-stats** no canto superior direito (quantos passaram nele nos últimos 30 dias)

<!-- screenshot: editor com diversos nós mostrando cores e mini-stats -->

---

## Atalhos úteis

Para adicionar um nó rapidamente:

- **Arraste** da paleta esquerda para o canvas
- **Clique** em qualquer nó da paleta — ele aparece no centro
- **Shift+N** — atalho para adicionar nó "Mensagem" no centro
- **D** — duplica o nó selecionado

Veja todos em [Atalhos do editor](./atalhos-de-teclado.md).

---

## Próximo passo

- Como [usar variáveis](./variaveis.md) (`{nome}`, `{email}`, etc.) nas mensagens
- Como [testar um fluxo](./modo-de-teste.md) antes de publicar
