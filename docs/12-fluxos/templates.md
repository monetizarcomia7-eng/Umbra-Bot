---
title: "Templates prontos"
description: "Os 8 templates de fluxo disponíveis e quando usar cada um."
order: 7
category: "Fluxos de venda"
---

# Templates prontos

**TL;DR:** São 8 modelos pré-configurados em 5 categorias. Escolher um template economiza 80% do tempo de criar do zero — você só ajusta os textos.

---

## Como acessar

Em **Fluxos de venda**, clique em **"Templates"** no canto superior direito.

<!-- screenshot: botão Templates na lista de fluxos -->

O modal abre com chips de categoria no topo. Clique em qualquer chip para filtrar.

---

## 🟢 Começar

### Fluxo em branco
Canvas vazio para você construir do zero.

> Use quando: já tem experiência e quer criar algo específico que nenhum template cobre.

---

## 🎯 Captura de leads

### Captura de lead (5 nós)
Estrutura mais simples: boas-vindas → pergunta nome → pergunta e-mail → aplica tag `lead` → confirmação.

> Use quando: você só quer coletar dados de contato antes de oferecer alguma coisa.
>
> **Exemplo de aplicação:** anúncio no Instagram → clique → bot pergunta nome/e-mail → você manda oferta por e-mail depois.

### Webinar / Aula gratuita (7 nós)
Inscrição em duas perguntas + tag `webinar-inscrito` + lembrete de 1 hora antes da aula.

> Use quando: você vai dar uma aula gratuita e quer formalizar inscrições.
>
> **Personalize:** ajuste o tempo do delay para o seu horário (ex: delay de 23h se a aula é amanhã 17h e o cliente se inscreve hoje 18h).

---

## 💰 Vendas

### Vendas simples (6 nós)
Apresenta oferta → 3 botões (comprar / saber mais / agora não) → resposta diferente para cada caminho.

> Use quando: você quer testar uma oferta direta sem muita complicação.
>
> **Dica:** Edite o nó "Oferta" colocando seu produto, preço e CTA. Não esqueça de trocar a URL do botão "Quero comprar" para seu checkout real.

### Recuperação de carrinho (5 nós)
Espera 1 hora → pergunta amigável → oferta com 10% off → espera 1 dia → última chance.

> Use quando: você quer recuperar clientes que viram a oferta mas não compraram.
>
> **Como acionar:** combine com keyword `carrinho` ou aplique manualmente uma tag e use trigger.

---

## ⭐ Pós-venda

### Pós-venda + upsell (7 nós)
Agradece → aplica tag `cliente` → espera 1 dia → pergunta como foi → 3 caminhos diferentes (upsell, agradecimento, suporte).

> Use quando: você quer aumentar ticket médio com clientes que já compraram.
>
> **Personalize:** edite o nó **Upsell** com seu produto premium e ajuste a URL do CTA.

---

## 🎮 Engajamento

### Quiz / Diagnóstico (7 nós)
3 perguntas → segmenta por resposta → aplica tag de nível → oferta personalizada.

> Use quando: você tem produtos diferentes para públicos diferentes e quer diagnosticar antes de oferecer.
>
> **Exemplo:** "Você é iniciante / intermediário / avançado?" → cada nível recebe um produto específico.

### Reativação de inativos (4 nós)
Mensagem amigável → 2 botões (sim/não) → oferta de retorno OU tag `inativo`.

> Use quando: você tem uma base de leads antigos que não compraram e quer tentar reativá-los.
>
> **Como acionar:** crie uma campanha em **Remarketing** que dispara este fluxo para contatos sem interação há 30+ dias.

---

## O que acontece quando você escolhe um template

1. Um **novo fluxo** é criado (não modifica o template original)
2. O nome vem do template (ex: "Captura de lead") — **mude para algo seu**
3. Status fica **Rascunho** — você ainda precisa publicar
4. Os nós já vêm conectados e posicionados
5. Você pode editar livremente: adicionar, remover, mover, mudar textos

---

## Posso modificar e salvar como template meu?

Hoje os templates são fixos no código. Mas você pode:

- **Duplicar** um fluxo seu (menu `...` → Duplicar) para reaproveitar
- **Exportar JSON** ([guia](./exportar-importar.md)) e guardar como backup
- **Importar JSON** quando quiser começar outro fluxo igual

> **Em breve:** marketplace de templates da comunidade (você compartilha seus melhores fluxos com outros usuários).

---

## Templates por objetivo

Qual usar para…

| Objetivo | Template |
|---|---|
| Só capturar nome + e-mail | Captura de lead |
| Inscrição em aula/webinar | Webinar / Aula gratuita |
| Vender produto único | Vendas simples |
| Recuperar quem não comprou | Recuperação de carrinho |
| Vender mais para quem já comprou | Pós-venda + upsell |
| Segmentar antes de oferecer | Quiz / Diagnóstico |
| Acordar leads antigos | Reativação de inativos |
| Algo totalmente customizado | Fluxo em branco |

---

## Próximo passo

- [Criar seu primeiro fluxo em 5 minutos](./criar-primeiro-fluxo.md) — usando o template "Captura de lead"
- [Variáveis](./variaveis.md) — personalizar mensagens dos templates
